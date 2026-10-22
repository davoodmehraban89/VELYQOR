import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAndPersistAlert} from '../src/alert-postgres-coordinator.mjs';

const uid='a1111111-1111-4111-8111-111111111111';
const recipientId='b2222222-2222-4222-8222-222222222222';
const principal={kind:'VERIFIED_SERVER_PRINCIPAL',verified:true,userId:uid};
const recipient={channel:'BALE',recipientRef:recipientId,optInVerified:true};
const timestamp='2026-10-22T12:00:00.000Z';
const rule={id:'usd-upper',symbol:'USD_IRT_FREE',provider:'LicensedFeed',unit:'IRT_PER_USD',
  legs:[{type:'ABOVE',side:'SELL',threshold:100}]};
const quote={provider:rule.provider,symbol:rule.symbol,unit:rule.unit,side:'SELL',
 price:110,timestamp,permission:{publicDisplay:true,derivedAlerts:true,historicalStorage:true}};
const NON_ADVISORY='اطلاعات آموزشی و غیرتوصیه‌ای';
const event={kind:'INFORMATIONAL_THRESHOLD',
 id:'usd-upper:2026-10-22T12:00:00.000Z:0',
 ruleId:rule.id,source:quote.provider,symbol:quote.symbol,side:quote.side,
 price:quote.price,at:timestamp,legIndex:0,ruleType:'ABOVE',
 labels:[NON_ADVISORY]};

function engine({
 trigger=true,
 gateStatus='GOOD',
 accept=quote,
 forcedEvent=event,
 conflicts=0
}={}){
 let revision=0, snapshot=null,mutations=0, reads=0, triggers=0;
 const db={
  calls:[],
  get mutations(){return mutations;},
  get reads(){return reads;},
  async query(sql,values){
   assert.ok(!sql.includes('INSERT INTO'));
   assert.ok(!sql.includes('DELETE'));
   this.calls.push({sql,values});
   if(sql.includes('FROM public.alert_rule_runtime')){
    reads++;
    return {rows:snapshot?[{revision:String(revision),state:snapshot}]:[]};
   }
   if(!sql.includes('FROM public.alert_rule_commit('))throw Error('unexpected SQL');
   if(conflicts>0){
    conflicts--;
    return {rows:[{outcome:'STALE_REVISION',new_revision:String(revision),outbox_id:null}]};
   }
   const [,key,expected,saved,eventKey,channel,recRef]=values;
   assert.equal(key,rule.id);
   assert.equal(expected,revision);
   if(eventKey){
    assert.equal(channel,'BALE');assert.equal(recRef,recipientId);
    triggers++;
   }else{
    assert.equal(channel,null);assert.equal(recRef,null);
   }
   snapshot=JSON.parse(saved);
   revision++;
   mutations++;
   return {rows:[{outcome:eventKey?'TRIGGERED_ENQUEUED':'STATE_SAVED',
    new_revision:String(revision),outbox_id:eventKey?recipientId:null}]};
  }
 };
 const domain={
  evaluateQuoteGate(_prev,o) {
   return {status:gateStatus,alertsSuspended:gateStatus!=='GOOD',
    accepted:gateStatus==='GOOD'?accept:null,state:{latest:o.timestamp}};
  },
  stepAlert(_rule,previous,_quote,g){
   if(previous?.phase==='TRIGGERED')throw Error('called terminal engine');
   if(g.status!=='GOOD'||!trigger)return{state:{
     id:rule.id,phase:'ARMED',lastTimestamp:quote.timestamp
    },events:[],reason:'QUALITY_HOLD'};
   return {state:{id:rule.id,phase:'TRIGGERED',eventId:forcedEvent.id,
    triggeredAt:timestamp,lastTimestamp:timestamp},
    events:[forcedEvent],reason:'TRIGGERED'};
  }
 };
 return {db,domain,get triggers(){return triggers}};
}
const args=e=>({db:e.db,domain:e.domain,principal,recipient,rule,observation:quote,now:timestamp});

test('valid trusted event is atomically enqueued exactly once',async()=>{
 const e=engine();
 const r=await evaluateAndPersistAlert(args(e));
 assert.equal(r.outcome,'TRIGGERED_ENQUEUED');
 assert.equal(r.revision,1);assert.equal(r.outboxId,recipientId);
 assert.equal(e.db.mutations,1);assert.equal(e.triggers,1);
 const repeat=await evaluateAndPersistAlert(args(e));
 assert.equal(repeat.outcome,'ALREADY_TERMINAL');
 assert.equal(e.db.mutations,1);assert.equal(e.triggers,1);
});
test('stale/unlicensed data cannot create an outbox message',async()=>{
 const e=engine({gateStatus:'RIGHTS_UNVERIFIED'});
 const r=await evaluateAndPersistAlert(args(e));
 assert.equal(r.outcome,'STATE_SAVED');
 assert.equal(r.outboxId,null);assert.equal(e.triggers,0);
});
test('CAS conflict retries are bounded and cannot double-notify',async()=>{
 let e=engine({conflicts:1});
 const r=await evaluateAndPersistAlert(args(e));
 assert.equal(r.outcome,'TRIGGERED_ENQUEUED');
 assert.equal(e.db.reads,2);
 assert.equal(e.triggers,1);
 e=engine({conflicts:5});
 const stopped=await evaluateAndPersistAlert({...args(e),maxAttempts:3});
 assert.equal(stopped.outcome,'REVISION_CONFLICT');
 assert.equal(e.triggers,0);
});
test('wrong source, side, unit, event price or type fail closed',async()=>{
 const base=event;
 const variants=[
  {...base,source:'OtherFeed'},
  {...base,side:'BUY'},
  {...base,price:111},
  {...base,ruleType:'STOP_LOSS'},
  {...base,labels:['بخر']},
  {...base,at:'2026-10-22T12:01:00.000Z'},
  {...base,legIndex:2},
  {...base,id:'bad\nid'}
 ];
 for(const forcedEvent of variants){
  const e=engine({forcedEvent});
  await assert.rejects(()=>evaluateAndPersistAlert(args(e)),/UNVERIFIED_EVENT_PROVENANCE/);
  assert.equal(e.db.mutations,0);
 }
});
test('unverified principal and missing consent fail before SQL',async()=>{
 const e=engine();
 await assert.rejects(()=>evaluateAndPersistAlert({...args(e),
   principal:{...principal,verified:false}}),/verified server/);
 await assert.rejects(()=>evaluateAndPersistAlert({...args(e),
   recipient:{...recipient,optInVerified:false}}),/verified recipient/);
 assert.equal(e.db.calls.length,0)
});
test('cannot process arbitrary quote with mismatched gate accepted observation',async()=>{
 const e=engine({accept:{...quote,price:999}});
 await assert.rejects(()=>evaluateAndPersistAlert(args(e)),/UNVERIFIED_EVENT_PROVENANCE/);
 assert.equal(e.triggers,0)
});
test('refuses inconsistent/malformed database responses',async()=>{
 const e=engine();
 const orig=e.db.query;
 e.db.query=async(sql,vals)=>{
  if(sql.includes('FROM public.alert_rule_runtime'))return{rows:[{},{}]};
  return orig(sql,vals);
 };
 await assert.rejects(()=>evaluateAndPersistAlert(args(e)),/CORRUPT_ALERT_STATE_RESULT/);
});

test('no historical-storage entitlement forbids ANY database read or write',async()=>{
 for(const permission of [null,{publicDisplay:true,derivedAlerts:true},
   {publicDisplay:true,historicalStorage:true},
   {derivedAlerts:true,historicalStorage:true}]){
   const e=engine();
   await assert.rejects(()=>evaluateAndPersistAlert({
     ...args(e),observation:{...quote,permission}
   }),/PRICE_STORAGE_OR_ALERT_RIGHTS_UNVERIFIED/);
   assert.equal(e.db.calls.length,0);
 }
});
