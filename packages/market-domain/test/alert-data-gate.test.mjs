import test from 'node:test';import assert from 'node:assert/strict';
import {initialGateState,evaluateQuoteGate,checkConfig} from '../src/alert-data-gate.mjs';
const now=Date.parse('2026-10-20T12:00:00.000Z');
const obs=(i=0,price=1000,side='SELL')=>({
 symbol:'USD_IRT_FREE',provider:'S1',unit:'IRT_PER_USD',side,price,
 timestamp:new Date(now-100000+i*1000).toISOString()
});
const run=(s,o,ext={})=>evaluateQuoteGate(s,o,{nowMs:now,config:{maxAgeMs:200000,recoverySamples:1},...ext});
test('base fresh quote accepted as information only',()=>{let r=run(null,obs());assert.equal(r.status,'GOOD');assert.equal(r.accepted.price,1000);assert.equal(r.accepted.side,'SELL')});
test('stale or missing source automatically suspend alert without emitting stale quote',()=>{
 let s=run(null,obs()).state;
 let a=run(s,{...obs(1),timestamp:new Date(now-400000).toISOString()});
 assert.equal(a.status,'STALE');assert.equal(a.alertsSuspended,true);assert.equal(a.accepted,null);
 a=run(s,{available:false});assert.equal(a.status,'SOURCE_UNAVAILABLE');
});
test('future timestamps rejected by freshness and no output',()=>{
 let r=run(null,{...obs(),timestamp:new Date(now+400000).toISOString()});
 assert.equal(r.status,'STALE');assert.equal(r.accepted,null)
});
test('repeat timestamp and out of order do not re-evaluate',()=>{
 let s=run(null,obs()).state;
 assert.equal(run(s,obs()).status,'DUPLICATE');
 assert.equal(run(s,obs(-1)).status,'OUT_OF_ORDER')
});
test('spike >3% quarantined until consistent subsequent tick',()=>{
 let s=run(null,obs()).state,r=run(s,obs(1,1050));
 assert.equal(r.status,'SPIKE_PENDING');
 assert.equal(r.alertsSuspended,true);
 const t=run(r.state,obs(2,1051));
 assert.equal(t.status,'GOOD');assert.equal(t.accepted.price,1051)
});
test('unconfirmed price spike remains quarantined if wildly different',()=>{
 let s=run(null,obs()).state;
 let t=run(s,obs(1,1050));t=run(t.state,obs(2,1200));
 assert.equal(t.status,'SPIKE_PENDING');assert.equal(t.accepted,null)
});
test('verified secondary source can confirm large first spike with same units/side',()=>{
 let s=run(null,obs()).state;
 const t=run(s,obs(1,1080),{secondary:{...obs(1,1080),provider:'S2'}});
 assert.equal(t.status,'GOOD')
});
test('secondary source dispute suspends alerts without falling back to wrong side',()=>{
 let s=run(null,obs()).state;
 const r=run(s,obs(1,1001),{secondary:{...obs(1,1100),provider:'S2'}});
 assert.equal(r.status,'SOURCE_DIVERGENCE');assert.equal(r.alertsSuspended,true);
 assert.equal(run(s,obs(1,1001),{secondary:{...obs(1,1001,'BUY'),provider:'S2'}}).status,'SOURCE_DIVERGENCE')
});
test('source, symbol, unit and quote side may not shift silently',()=>{
 const s=run(null,obs()).state;
 for(const f of ['unit','side','symbol','provider']){
   const o={...obs(1),[f]:f==='side'?'BUY':'OTHER'};
   assert.equal(run(s,o).status,'INVALID')
 }
});
test('STALE recovered only after configured distinct valid samples',()=>{
 const conf={maxAgeMs:200000,recoverySamples:2};
 let r=run(null,obs(),{config:conf});assert.equal(r.status,'RECOVERING');
 r=run(r.state,obs(1),{config:conf});assert.equal(r.status,'GOOD');
 r=run(r.state,null,{config:conf});assert.equal(r.status,'SOURCE_UNAVAILABLE');
 r=run(r.state,obs(2),{config:conf});assert.equal(r.status,'RECOVERING');
 r=run(r.state,obs(3),{config:conf});assert.equal(r.status,'GOOD')
});
test('closed market does not feed samples into recovery',()=>{
 const r=run(null,obs(),{marketOpen:false});assert.equal(r.status,'CLOSED_MARKET');assert.equal(r.alertsSuspended,true)
});
test('rejects bad config and invalid price',()=>{
 assert.throws(()=>checkConfig({maxAgeMs:-1}));
 assert.throws(()=>checkConfig({recoverySamples:0}));
 assert.equal(run(null,{...obs(),price:Infinity}).status,'INVALID')
});
