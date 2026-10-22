import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {evaluateAndPersistAlert} from '../packages/market-domain/src/alert-postgres-coordinator.mjs';

const root=process.env.CHARTNOVA_PINNED_PR33_MODULE_DIR;
if(!root||!root.startsWith('/'))throw Error('Pinned PR #33 source directory required');
const gateMod=await import(pathToFileURL(resolve(root,'alert-data-gate.mjs')).href);
const engineMod=await import(pathToFileURL(resolve(root,'informational-alert-engine.mjs')).href);
const domain={evaluateQuoteGate:gateMod.evaluateQuoteGate,stepAlert:engineMod.stepAlert};
const time=i=>new Date(Date.parse('2026-10-22T12:00:00.000Z')+i*60_000).toISOString();
const p={kind:'VERIFIED_SERVER_PRINCIPAL',verified:true,
 userId:'a1111111-1111-4111-8111-111111111111'};
const destination={channel:'BALE',recipientRef:'b2222222-2222-4222-8222-222222222222',
 optInVerified:true};
const rule={id:'licensed-usd-above',symbol:'USD_IRT_FREE',unit:'IRT_PER_USD',
 provider:'TestEntitledFeed',legs:[{type:'ABOVE',side:'SELL',threshold:105}]};
const goodPermission={publicDisplay:true,derivedAlerts:true};
const q=(i,price,permission=goodPermission)=>({
 symbol:rule.symbol,unit:rule.unit,provider:rule.provider,side:'SELL',
 timestamp:time(i),price,permission
});
const now=time(5);

function mockPg(){
 let record=null,revision=0,enqueue=0;
 return{
  get record(){return record},
  get enqueue(){return enqueue},
  async query(sql,vars){
   if(sql.includes('FROM public.alert_rule_runtime'))
    return{rows:record?[{state:record,revision:String(revision)}]:[]};
   if(!sql.includes('FROM public.alert_rule_commit('))throw Error('unexpected SQL');
   const expected=vars[2];
   if(expected!==revision)
    return{rows:[{outcome:'STALE_REVISION',new_revision:String(revision),outbox_id:null}]};
   const state=JSON.parse(vars[3]);
   record=state;
   revision++;
   if(vars[4])enqueue++;
   return {rows:[{outcome:vars[4]?'TRIGGERED_ENQUEUED':'STATE_SAVED',
    new_revision:String(revision),
    outbox_id:vars[4]?'c3333333-3333-4333-8333-333333333333':null}]};
  }
 };
}
const invoke=(db,observation,opts={})=>evaluateAndPersistAlert({
 db,domain,principal:p,recipient:destination,rule,observation,now,
 gateOptions:{config:{recoverySamples:1,maxAgeMs:600000}},...opts
});
test('real PR33 modules: good -> spike quarantine -> next-tick confirmation -> one persisted alert',async()=>{
 const db=mockPg();
 const first=await invoke(db,q(0,100));
 assert.equal(first.outcome,'STATE_SAVED');
 assert.equal(db.record.alert.phase,'ARMED');
 const spike=await invoke(db,q(1,110));
 assert.equal(spike.outcome,'STATE_SAVED');
 assert.equal(db.record.gate.suspended,true);
 assert.equal(db.enqueue,0);
 const confirmed=await invoke(db,q(2,110.1));
 assert.equal(confirmed.outcome,'TRIGGERED_ENQUEUED');
 assert.equal(db.record.alert.phase,'TRIGGERED');
 assert.equal(db.enqueue,1);
 assert.equal(db.record.alert.eventId,'licensed-usd-above:'+time(2)+':0');
 const second=await invoke(db,q(3,111));
 assert.equal(second.outcome,'ALREADY_TERMINAL');
 assert.equal(db.enqueue,1);
});
test('real PR33 data gate: stale, unlicensed and wrong quote side cannot enqueue',async()=>{
 for(const sample of [
  q(1,120,null),
  {...q(1,120),timestamp:'2026-10-21T00:00:00.000Z'}
 ]){
  const db=mockPg();
  const r=await invoke(db,sample);
  assert.equal(r.outcome,'STATE_SAVED');
  assert.equal(db.enqueue,0);
  assert.equal(db.record.gate.suspended,true);
 }
 const db=mockPg();
 await assert.rejects(()=>invoke(db,{...q(1,120),side:'BUY'}),/exit side/);
 assert.equal(db.record,null);
});
