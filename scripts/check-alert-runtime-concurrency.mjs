/**
 * Local, disposable GitHub Actions PostgreSQL only.
 * Cross-session compare-and-swap: two worker-like evaluations of same rule,
 * same revision and same trigger may commit exactly one outbox event.
 */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';

const env={...process.env};
if(env.CI!=='true'||!['localhost','127.0.0.1'].includes(env.PGHOST)||
 env.PGDATABASE!=='velyqor_test'||env.VELYQOR_TEST_DATABASE!=='velyqor_test')
 throw new Error('REFUSING_NON_LOCAL_DATABASE');
const user='c1111111-1111-4111-8111-111111111111';
const dest='d2222222-2222-4222-8222-222222222222';
const event='cross-session-alert:2026-10-22T12:00:00.000Z:0';
const rule='cross-session-alert';
const time='2026-10-22T12:00:00.000Z';
const state=JSON.stringify({alert:{
 id:rule,phase:'TRIGGERED',eventId:event,triggeredAt:time,lastTimestamp:time
},gate:{suspended:false,lastSampleAt:time,lastAccepted:{
 timestamp:time,provider:'S1',symbol:'USD_IRT_FREE',
 side:'SELL',unit:'IRT_PER_USD',price:1100
}}});
const stmt=q=>execFileSync('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',q],
 {env,encoding:'utf8',timeout:14000,stdio:['ignore','pipe','pipe']}).trim();

assert.equal(stmt('SELECT current_database()'),'velyqor_test');
stmt("INSERT INTO public.app_users(id) VALUES ('"+user+"') ON CONFLICT DO NOTHING");
stmt("INSERT INTO public.alert_notification_consents(user_id,recipient_ref,channel,consented_at) VALUES ('"+
 user+"','"+dest+"','BALE','2026-10-22T11:00:00Z')");
const sql="SELECT outcome||'|'||new_revision::text||'|'||coalesce(outbox_id::text,'') "+
 "FROM public.alert_rule_commit('"+user+"','"+rule+"',0,'"+
 state+"'::jsonb,'"+event+"','BALE','"+dest+"','2026-10-22T12:00:00Z')";
const output=await Promise.all([0,1].map(()=>new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],
  {env,stdio:['ignore','pipe','pipe']});
 let out='';
 child.stdout.on('data',x=>out+=x.toString());
 child.on('error',reject);
 child.on('close',code=>code===0?resolve(out.trim()):
   reject(new Error('CONCURRENT_CAS_STATEMENT_FAILED_REDACTED')));
})));
const success=output.filter(s=>s.startsWith('TRIGGERED_ENQUEUED|1|'));
const losing=output.filter(s=>s==='STALE_REVISION|1|'||s==='ALREADY_TERMINAL|1|');
assert.equal(success.length,1);
assert.equal(losing.length,1);
const count=stmt("SELECT count(*) FROM public.notification_outbox WHERE user_id='"+
 user+"' AND event_key='"+event+"'");
assert.equal(count,'1');
const runtime=stmt("SELECT revision::text||':'||(state #>> '{alert,phase}') "+
 "FROM public.alert_rule_runtime WHERE user_id='"+user+"' AND rule_key='"+rule+"'");
assert.equal(runtime,'1:TRIGGERED');
console.log('ALERT_STATE_OUTBOX_CAS_VERIFIED',JSON.stringify({
 simultaneousEvaluations:2,successfulTriggers:1,staleOrTerminal:1,
 outboxRows:1,revision:1,liveDatabaseTouched:false,
 location:'disposable_local_postgres_ci'
}));
