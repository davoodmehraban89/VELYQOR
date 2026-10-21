import test from 'node:test';import assert from 'node:assert/strict';
import {initialAlertState,stepAlert,markNotified,closeAlert} from '../src/informational-alert-engine.mjs';
const at=i=>new Date(Date.parse('2026-10-20T12:00:00Z')+i*60000).toISOString();
const q=(i,p,extras={})=>({timestamp:at(i),price:p,provider:'S1',symbol:'USD_IRT_FREE',side:'SELL',unit:'IRT_PER_USD',...extras});
const g=x=>({status:'GOOD',alertsSuspended:false,accepted:x});
const leg=(type,extras={})=>({type,side:'SELL',threshold:100,position:'LONG',entry:100,...extras});
const rule=(id,legs,extra={})=>({id,legs,...extra});
test('above/below thresholds generate one event, no repeated triggers',()=>{
 for(const [kind,price] of [['ABOVE',102],['BELOW',98]]){
  const r=rule('one',[leg(kind)]),tick=q(0,price);
  let v=stepAlert(r,null,tick,g(tick));
  assert.equal(v.state.phase,'TRIGGERED');assert.equal(v.events.length,1);
  let again=stepAlert(r,v.state,q(1,price),g(q(1,price)));
  assert.equal(again.events.length,0);
 }
});
test('missing/STALE gate suspends, no trigger even if price crossed',()=>{
 const r=rule('one',[leg('ABOVE')]),tick=q(0,110);
 for(const gate of [null,{status:'STALE',alertsSuspended:true,accepted:null}]){
  const v=stepAlert(r,null,tick,gate);assert.equal(v.events.length,0);
  assert.equal(v.reason,'QUALITY_HOLD')
 }
});
test('confirmation N valid consecutive samples with gap and out of order protection',()=>{
 const r=rule('x',[leg('ABOVE')],{confirmSamples:2,maxGapMs:60000});
 let t=q(0,110),v=stepAlert(r,null,t,g(t));
 assert.equal(v.reason,'AWAITING_CONFIRMATION');
 t=q(0,110);let dup=stepAlert(r,v.state,t,g(t));assert.equal(dup.reason,'DUPLICATE');
 t=q(2,110);v=stepAlert(r,v.state,t,g(t));assert.equal(v.reason,'AWAITING_CONFIRMATION');
 t=q(3,111);v=stepAlert(r,v.state,t,g(t));assert.equal(v.events.length,1);
});
test('time duration confirmation needs true elapsed time',()=>{
 const r=rule('t',[leg('BELOW')],{confirmMs:120000});
 let x=q(0,80),v=stepAlert(r,null,x,g(x));assert.equal(v.events.length,0);
 x=q(1,80);v=stepAlert(r,v.state,x,g(x));assert.equal(v.events.length,0);
 x=q(2,80);v=stepAlert(r,v.state,x,g(x));assert.equal(v.events.length,1)
});
test('trailing long highest and stop never fall: only SELL exit',()=>{
 const r=rule('long',[leg('TRAILING_STOP',{mode:'ATR',distance:2})]);
 let x=q(0,100,{atr:2}),v=stepAlert(r,null,x,g(x));
 assert.equal(v.state.highWater,100);assert.equal(v.state.stop,96);
 x=q(1,110,{atr:2});v=stepAlert(r,v.state,x,g(x));assert.equal(v.state.stop,106);
 x=q(2,108,{atr:4});v=stepAlert(r,v.state,x,g(x));assert.equal(v.state.stop,106);
 x=q(3,105,{atr:2});v=stepAlert(r,v.state,x,g(x));
 assert.equal(v.state.phase,'TRIGGERED');assert.equal(v.events[0].side,'SELL');
});
test('short trailing uses BUY price, low water decreases and stop never increases',()=>{
 const r=rule('short',[leg('TRAILING_STOP',{position:'SHORT',side:'BUY',mode:'ATR',distance:1})]);
 let x=q(0,100,{side:'BUY',atr:2}),v=stepAlert(r,null,x,g(x));
 assert.equal(v.state.stop,102);
 x=q(1,90,{side:'BUY',atr:3});v=stepAlert(r,v.state,x,g(x));
 assert.equal(v.state.stop,93);
 x=q(2,91,{side:'BUY',atr:10});v=stepAlert(r,v.state,x,g(x));
 assert.equal(v.state.stop,93);
 x=q(3,94,{side:'BUY',atr:1});v=stepAlert(r,v.state,x,g(x));
 assert.equal(v.events.length,1)
});
test('missing ATR never silently substitutes constant pct',()=>{
 const r=rule('atr',[leg('TRAILING_STOP',{mode:'ATR',distance:2})]);
 const x=q(0,100);const v=stepAlert(r,null,x,g(x));
 assert.equal(v.reason,'ATR_DATA_UNAVAILABLE');assert.equal(v.events.length,0);
});
test('optional fixed-percent trailing, rejects inappropriate percentages',()=>{
 const r=rule('percent',[leg('TRAILING_STOP',{mode:'PCT',distance:5})]);
 let x=q(0,100),v=stepAlert(r,null,x,g(x));assert.equal(v.state.stop,95);
 x=q(1,94);v=stepAlert(r,v.state,x,g(x));assert.equal(v.events.length,1);
 assert.throws(()=>stepAlert(rule('bad',[leg('TRAILING_STOP',{mode:'PCT',distance:100})]),null,x,g(x)))
});
test('OCO simultaneous SL and TP chooses protective stop and cancels other',()=>{
 const r=rule('oco',[leg('STOP_LOSS',{threshold:105}),leg('TAKE_PROFIT',{threshold:100})]);
 const x=q(0,103),v=stepAlert(r,null,x,g(x));
 assert.equal(v.events.length,1);
 assert.equal(v.events[0].ruleType,'STOP_LOSS');
 assert.deepEqual(v.events[0].cancelledOcoLegs,[1])
});
test('notification state requires verified delivery ID and can close only in order',()=>{
 const r=rule('id',[leg('ABOVE')],{cooldownMs:600000}),x=q(0,101),v=stepAlert(r,null,x,g(x));
 assert.throws(()=>markNotified(r,v.state,{eventId:'bad',at:at(1),deliveryId:'ok'}));
 assert.throws(()=>closeAlert(v.state,at(1)));
 const sent=markNotified(r,v.state,{eventId:v.events[0].id,at:at(1),deliveryId:'provider-id'});
 assert.equal(sent.phase,'NOTIFIED');assert.equal(sent.cooldownUntil,at(11));
 assert.equal(stepAlert(r,sent,q(2,110),g(q(2,110))).events.length,0);
 assert.equal(closeAlert(sent,at(2)).phase,'CLOSED')
});
test('stop loss side must correspond to liquidation side',()=>{
 assert.throws(()=>stepAlert(rule('bad',[leg('STOP_LOSS',{side:'BUY'})]),null,q(0,99),g(q(0,99))))
});
test('nonmatching quote side and malformed alerts produce no event',()=>{
 const r=rule('x',[leg('ABOVE')]);
 const x=q(0,110,{side:'BUY'});assert.equal(stepAlert(r,null,x,g(x)).reason,'QUOTE_SIDE_OR_PRICE_INVALID');
 assert.throws(()=>stepAlert({id:'x',legs:[]},null,x,g(x)));
});
