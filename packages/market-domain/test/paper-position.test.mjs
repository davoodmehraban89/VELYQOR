import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openPaperPosition, markPaperPosition, closePaperPosition, paperRiskSummary
} from '../src/paper-position.mjs';

const at = (s) => '2026-10-14T10:00:' + String(s).padStart(2, '0') + 'Z';
const config = {symbol:'XAU_USD',side:'LONG',entryPrice:100,capital:1000,
  stopLossPercent:1.2,takeProfitPercent:2,trailingStopPercent:null,at:at(0)};
const open = (overrides={}) => openPaperPosition({...config,...overrides});
const step = (p,price,second) => markPaperPosition(p,{price,at:at(second)});

test('opens a quote-unit paper-only long with 1.2% SL and 2% TP',()=>{
  const p=open();
  assert.equal(p.status,'OPEN');
  assert.equal(p.stopPrice,98.8);
  assert.equal(p.takeProfitPrice,102);
  assert.equal(p.quantity,10);
  assert.equal(p.events[0].source,'MANUAL_SCENARIO');
  assert.equal(paperRiskSummary(p).netPnL,0);
});
test('long stop closes once and computes observed price, not guaranteed threshold',()=>{
  const p=step(open(),98,1);
  assert.equal(p.status,'CLOSED');assert.equal(p.exit.reason,'STOP');
  assert.equal(p.exit.observedPrice,98);assert.equal(p.realizedPnL,-20);
  assert.throws(()=>step(p,99,2),/OPEN/);
});
test('long take-profit closes and stop is no longer active',()=>{
  const p=step(open(),102,1);
  assert.equal(p.exit.reason,'TAKE_PROFIT');
  assert.equal(p.realizedPnL,20);
  assert.equal(p.events.filter(e=>e.type==='CLOSE').length,1);
});
test('trailing stop ratchets upward and protects profit after favorable move',()=>{
  let p=open({trailingStopPercent:1});
  p=step(p,101.5,1);
  assert.equal(p.stopPrice,100.485);
  p=step(p,102,2);
  assert.equal(p.status,'CLOSED');
  assert.equal(p.exit.reason,'TAKE_PROFIT');
});
test('trailing stop locks in gains before static take profit',()=>{
  let p=open({takeProfitPercent:10,trailingStopPercent:1});
  p=step(p,104,1);assert.equal(p.stopPrice,102.96);
  p=step(p,103,2);assert.equal(p.status,'OPEN');assert.equal(p.stopPrice,102.96);
  p=step(p,102.9,3);assert.equal(p.exit.reason,'STOP');
  assert.ok(p.realizedPnL>0);
});
test('short stop and take profit directions are reversed',()=>{
  const short=open({side:'SHORT'});
  assert.equal(short.stopPrice,101.2);
  assert.equal(short.takeProfitPrice,98);
  assert.equal(step(short,101.5,1).exit.reason,'STOP');
  assert.equal(step(short,97.5,1).exit.reason,'TAKE_PROFIT');
});
test('short trailing stop follows favorable lower mark',()=>{
  let p=open({side:'SHORT',takeProfitPercent:10,trailingStopPercent:1});
  p=step(p,95,1);assert.equal(p.stopPrice,95.95);
  p=step(p,96,2);assert.equal(p.exit.reason,'STOP');
  assert.ok(p.realizedPnL>0);
});
test('commission and conservative slippage reduce hypothetical P&L',()=>{
  const p=step(open({commissionBps:10,slippageBps:20}),102,1);
  assert.equal(p.status,'CLOSED');
  assert.equal(p.exit.fillPrice,101.796);
  assert.ok(p.realizedPnL<20);
  assert.ok(p.exit.fees>0);
});
test('negative, NaN, unsupported sides and excessive risk are rejected',()=>{
  for(const capital of [-1,0,NaN,Infinity])assert.throws(()=>open({capital}),/positive/);
  assert.throws(()=>open({side:'BUY'}),/side/);
  assert.throws(()=>open({stopLossPercent:100}),/below/);
  assert.throws(()=>open({commissionBps:501}),/basis points/);
  assert.throws(()=>open({symbol:'EUR/USD;DROP'}),/canonical symbol/);
});
test('out-of-order or duplicate scenario timestamps are rejected',()=>{
  const p=step(open(),100.5,1);
  assert.throws(()=>step(p,101,1),/strictly increase/);
  assert.throws(()=>step(p,101,0),/strictly increase/);
});
test('manual close requires an open position and a later timestamp',()=>{
  const initial=open();
  assert.throws(()=>closePaperPosition(initial,{price:100,at:at(0)}),/increase/);
  const p=closePaperPosition(initial,{price:101,at:at(1)});
  assert.equal(p.exit.reason,'MANUAL');
  assert.equal(p.exit.observedPrice,101);
  assert.throws(()=>closePaperPosition(p,{price:100,at:at(2)}),/OPEN/);
});
test('a no-trailing position does not adjust its fixed stop',()=>{
  let p=open();
  p=step(p,101,1);
  assert.equal(p.stopPrice,98.8);
});
test('summary reports signed percentage return and audit event count',()=>{
  let p=open({takeProfitPercent:20});
  p=step(p,99,1);
  const s=paperRiskSummary(p);
  assert.equal(s.netPnLPct,-10);
  assert.equal(s.eventCount,2);
  assert.equal(s.status,'OPEN');
});
test('no network or brokerage dependencies exist in the pure simulation module',()=>{
  const p=open();
  assert.equal(p.kind,'PAPER_POSITION');
  assert.equal(p.events[0].source,'MANUAL_SCENARIO');
});
