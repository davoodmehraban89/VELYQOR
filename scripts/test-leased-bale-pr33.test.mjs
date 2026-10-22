import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {dispatchLeasedBale} from '../packages/market-domain/src/leased-bale-dispatch.mjs';

const root=process.env.CHARTNOVA_PINNED_PR33_MODULE_DIR;
if(!root||!root.startsWith('/'))throw Error('Pinned PR33 adapter directory required');
const {baleOneMessage}=await import(pathToFileURL(resolve(root,'bale-once-adapter.mjs')).href);
const outboxId='e1111111-1111-4111-8111-111111111111';
const claimToken='f2222222-2222-4222-8222-222222222222';
const at='2026-10-22T12:00:00.000Z';
const token='123456:aVeryLongSyntheticNeverRealToken';
const base={outboxId,claimToken,at,token,chatId:'12345',text:'پیام آزمایشی بدون ارسال واقعی'};
function fakeStore({consented=true}={}){
 let permit=false,finished=null;
 return{get permit(){return permit},get finished(){return finished},
  async query(sql,params){
   assert.equal(params[0],outboxId);
   assert.equal(params[1],claimToken);
   if(sql.includes('alert_notification_begin_egress')){
    const ok=!permit&&consented;
    if(ok)permit=true;
    return {rows:[{permitted:ok}]};
   }
   if(sql.includes('alert_notification_egress_allowed'))
    return {rows:[{permitted:consented}]};
   if(sql.includes('notification_outbox_finish')){
    if(!permit)throw Error('unexpected finish without permit');
    finished=params[2];
    return {rows:[{outcome:finished}]};
   }
   throw Error('unexpected SQL');
  }
 };
}
function wrappedBale(transport){
 return x=>baleOneMessage({...x,transport});
}
function fakeTransport(counters,{group=false,fail=false}={}){
 return async url=>{
  if(url.endsWith('/getChat')){
   counters.preflight++;
   return {status:200,json:async()=>({ok:true,result:{id:12345,
    type:group?'group':'private'}})};
  }
  if(url.endsWith('/sendMessage')){
   counters.send++;
   return fail?{status:503,json:async()=>({ok:false})}:
    {status:200,json:async()=>({ok:true,result:{message_id:99,chat:{id:12345}}})};
  }
  throw Error('unexpected request route');
 };
}
test('real Bale adapter: exactly one private-chat synthetic send after both SQL checks',async()=>{
 const db=fakeStore(),counters={preflight:0,send:0};
 const run=()=>dispatchLeasedBale({...base,db,
   baleOneMessage:wrappedBale(fakeTransport(counters))});
 const results=await Promise.all([run(),run(),run()]);
 assert.equal(results.filter(x=>x.status==='PROVIDER_ACCEPTED').length,1);
 assert.equal(results.filter(x=>x.status==='BLOCKED').length,2);
 assert.equal(db.finished,'SENT');
 assert.equal(counters.preflight,1);
 assert.equal(counters.send,1);
 assert.equal(results[0].readConfirmed,false);
 assert.ok(!JSON.stringify(results).includes(token));
});
test('recipient revocation before permit: no message, no network',async()=>{
 const db=fakeStore({consented:false}),counters={preflight:0,send:0};
 const result=await dispatchLeasedBale({...base,db,
  baleOneMessage:wrappedBale(fakeTransport(counters))});
 assert.equal(result.status,'BLOCKED');
 assert.equal(counters.preflight,0);assert.equal(counters.send,0);
});
test('revoked after permit but before network: no message, terminal UNKNOWN',async()=>{
 const db=fakeStore({consented:true});
 let calls=0;
 const query=db.query.bind(db);
 db.query=async(sql,params)=>{
  const r=await query(sql,params);
  if(sql.includes('alert_notification_begin_egress'))calls++;
  if(sql.includes('alert_notification_egress_allowed'))
   return {rows:[{permitted:false}]};
  return r;
 };
 const counters={preflight:0,send:0};
 const result=await dispatchLeasedBale({...base,db,
   baleOneMessage:wrappedBale(fakeTransport(counters))});
 assert.equal(calls,1);
 assert.equal(result.status,'BLOCKED');assert.equal(result.sent,false);
 assert.equal(db.finished,'UNKNOWN');
 assert.equal(counters.send,0);
});
test('ambiguous provider HTTP result: no automatic retry despite 503 response',async()=>{
 const db=fakeStore(),counters={preflight:0,send:0};
 const one=()=>dispatchLeasedBale({...base,db,
  baleOneMessage:wrappedBale(fakeTransport(counters,{fail:true}))});
 const result=await one();
 assert.equal(result.status,'UNKNOWN');
 assert.equal(db.finished,'UNKNOWN');
 const again=await one();
 assert.equal(again.status,'BLOCKED');
 assert.equal(counters.send,1);
});
test('group chat rejected in real PR33 adapter; cannot claim accepted',async()=>{
 const db=fakeStore(),counters={preflight:0,send:0};
 const result=await dispatchLeasedBale({...base,db,
  baleOneMessage:wrappedBale(fakeTransport(counters,{group:true}))});
 assert.equal(result.status,'UNKNOWN');
 assert.equal(counters.send,0);assert.equal(db.finished,'UNKNOWN');
});
test('incorrect ID and missing trusted SQL driver fail before network',async()=>{
 await assert.rejects(()=>dispatchLeasedBale({...base,db:null,
  baleOneMessage:()=>{throw Error('network cannot happen')}}),/invalid server dispatch/);
 await assert.rejects(()=>dispatchLeasedBale({...base,outboxId:'bad',
  db:fakeStore(),baleOneMessage:()=>{throw Error('network cannot happen')}}),/invalid server dispatch/);
});
