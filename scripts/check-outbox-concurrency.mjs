/**
 * CI-ONLY PostgreSQL cross-session locking smoke test.
 * Refuses to execute against any host or DB other than the local disposable
 * GitHub Actions service. No live Neon access and no confidential values.
 */
import {execFileSync,spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const env={...process.env};
if(env.CI!=='true'||!['localhost','127.0.0.1'].includes(env.PGHOST)||
   env.PGDATABASE!=='velyqor_test'||env.VELYQOR_TEST_DATABASE!=='velyqor_test'){
 throw new Error('REFUSING non-CI or non-local PostgreSQL access');
}
const user='a1111111-1111-4111-8111-111111111111';
const recipient='b2222222-2222-4222-8222-222222222222';
const sql=statement=>execFileSync('psql',[
 '-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',statement
],{env,timeout:12000,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const enqueue=event=>"SELECT public.notification_outbox_enqueue('"+
  user+"','"+event+"','BALE','"+recipient+"',3);";

assert.equal(sql('SELECT current_database()'),'velyqor_test');
sql("INSERT INTO public.app_users(id) VALUES('"+user+"') ON CONFLICT DO NOTHING;");

// Two separate psql connections race to enqueue the exact same logical event.
const [a,b]=await Promise.all([1,2].map(()=>new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
   '-c',enqueue('ci-parallel-enqueue')],{env,stdio:['ignore','pipe','pipe']});
 let out='';
 child.stdout.on('data',x=>out+=x);
 child.on('error',reject);
 child.on('close',code=>code===0?resolve(out.trim()):
   reject(new Error('Concurrent psql enqueue failed (details redacted)')));
})));
assert.match(a,/^[a-f0-9-]{36}$/i);
assert.equal(a,b);
assert.equal(sql("SELECT count(*) FROM public.notification_outbox WHERE event_key='ci-parallel-enqueue'"),'1');

// First claim is held UNCOMMITTED in a separate live connection; another
// connection must SKIP it instead of waiting, stealing or double-claiming.
const first=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],
 {env,stdio:['pipe','pipe','pipe']});
let output='',finished=false;
first.stdout.on('data',v=>output+=v.toString());
first.on('close',()=>{finished=true});
const awaitOutput=async pattern=>{
 const start=Date.now();
 while(!pattern.test(output)){
  if(finished)throw new Error('First transaction unexpectedly closed (redacted)');
  if(Date.now()-start>12000)throw new Error('First transaction did not claim in time');
  await new Promise(ok=>setTimeout(ok,50));
 }
};
try{
 first.stdin.write('BEGIN;\n');
 first.stdin.write("SELECT outbox_id FROM public.notification_outbox_claim(now(),30) WHERE event_key='ci-parallel-enqueue';\n");
 await awaitOutput(/[a-f0-9]{8}-[a-f0-9-]{27}/i);
 const committedClaimId=output.match(/[a-f0-9]{8}-[a-f0-9-]{27}/i)[0];
 assert.equal(committedClaimId,a);

 const before=sql('SELECT count(*) FROM public.notification_outbox_claim(now(),30)');
 assert.equal(before,'0','Second connection claimed a locked message');

 first.stdin.write('COMMIT;\n\\q\n');
 const closed=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('psql did not complete')),8000);
  first.on('close',code=>{clearTimeout(timer);resolve(code)});
 });
 assert.equal(closed,0,'claim transaction failed');
 const after=sql('SELECT count(*) FROM public.notification_outbox_claim(now(),30)');
 assert.equal(after,'0','Message claimed twice after the first commit');
 const snapshot=sql("SELECT status||':'||attempts FROM public.notification_outbox WHERE id='"+a+"'");
 assert.equal(snapshot,'LEASED:1');
 console.log('OUTBOX_CROSS_SESSION_VERIFIED',JSON.stringify({
  parallelEnqueueSameId:true,parallelEnqueueStoredRows:1,
  independentWorkerSkippedLockedRow:true,
  noSecondClaimAfterCommit:true,attemptCount:1,
  database:'disposable_local_ci_only'
 }));
}finally{
 if(!finished)first.kill('SIGTERM');
}
