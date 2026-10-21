import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateQuoteGate} from '../packages/market-domain/src/alert-data-gate.mjs';
import {stepAlert} from '../packages/market-domain/src/informational-alert-engine.mjs';
import {inspectTwoSources} from '../packages/market-domain/src/licensed-provider-selector.mjs';
import {quotaBudget} from '../packages/market-domain/src/free-quota-budget.mjs';
const paths=[
 'packages/market-domain/src/alert-data-gate.mjs',
 'packages/market-domain/src/informational-alert-engine.mjs',
 'packages/market-domain/src/licensed-provider-selector.mjs',
 'packages/market-domain/src/notification-outbox.mjs',
 'packages/market-domain/src/free-quota-budget.mjs',
 'packages/market-domain/src/educational-atr-backtest.mjs'
];
test('security lens: six new domain modules have zero orders, HTTP, secrets and persistent writes',async()=>{
 for(const path of paths){
  const src=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(src,/\bfetch\s*\(|\bWebSocket\s*\(|\bplaceOrder\s*\(|\bexecuteTrade\s*\(|\bprocess\.env\b|\bKV\.put\b/);
  assert.doesNotMatch(src,/\b(import|require)\s*\(/);
  assert.ok(!src.includes('eval('));
 }
});
test('adversarial lens: 1000 invalid/stale/random prices never emitted from data gate',()=>{
 let seed=214013;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32};
 const now=Date.parse('2026-10-20T12:00:00Z');
 for(let i=0;i<1000;i++){
  const bad=[0,-rand()*100,NaN,Infinity,-Infinity][i%5];
  const q={symbol:'USD_IRT_FREE',provider:'S1',unit:'IRT_PER_USD',side:'SELL',
    price:bad,timestamp:new Date(now-5000).toISOString()};
  const result=evaluateQuoteGate(null,q,{nowMs:now,config:{recoverySamples:1}});
  assert.equal(result.alertsSuspended,true);
  assert.equal(result.accepted,null)
 }
});
test('adversarial lens: once triggered no further events, regardless of repeated/future ticks',()=>{
 const rule={id:'fuzz',symbol:'USD_IRT_FREE',provider:'S1',unit:'IRT_PER_USD',
  legs:[{type:'ABOVE',side:'SELL',threshold:100}]};
 const gate=q=>({status:'GOOD',alertsSuspended:false,accepted:q});
 const ts=i=>new Date(Date.parse('2026-10-20T12:00:00Z')+i*1000).toISOString();
 const make=i=>({provider:'S1',symbol:'USD_IRT_FREE',unit:'IRT_PER_USD',
    side:'SELL',price:101+i,timestamp:ts(i)});
 let a=stepAlert(rule,null,make(0),gate(make(0)));
 assert.equal(a.events.length,1);
 for(let i=1;i<=1000;i++){
  const b=stepAlert(rule,a.state,make(i),gate(make(i)));
  assert.equal(b.events.length,0);
 }
});
test('adversarial lens: random budget windows never exceed quota',()=>{
 let seed=1;const rand=()=>{seed=(seed*1103515245+12345)>>>0;return seed/2**32};
 for(let i=0;i<1000;i++){
  const calls=1+Math.floor(rand()*1000),per=1+Math.floor(rand()*100);
  try{
   const q=quotaBudget({calls,windowMinutes:1+Math.floor(rand()*60000),
     callsPerPoll:per,reserveFraction:rand()*.5});
   assert.ok(q.plannedCalls<=q.availableCalls);assert.ok(q.remainingCalls>=0);
  }catch(e){assert.ok(e instanceof RangeError)}
 }
});
test('security lens: no source can bypass explicit dual entitlement',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),timestamp=new Date(now).toISOString();
 const q={symbol:'USD_IRT_FREE',provider:'a',side:'SELL',unit:'IRT_PER_USD',price:1000,timestamp};
 const r=inspectTwoSources(q,{...q,provider:'b'},{nowMs:now});
 assert.equal(r.observation,null);assert.equal(r.alertsSuspended,true)
});
