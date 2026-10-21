import test from 'node:test';import assert from 'node:assert/strict';
import {validateBacktestBars,trueRanges,atrWilder,backtestTrailing} from '../src/educational-atr-backtest.mjs';
const permission={historicalStorage:true,derivedAnalysis:true};
const base=Array.from({length:7},(_,i)=>({
 timestamp:new Date(Date.parse('2026-10-20T00:00:00Z')+i*3600000).toISOString(),
 open:100+i,high:102+i,low:98+i,close:101+i,
 side:'SELL',unit:'IRT_PER_USD',origin:'PROVIDER_OHLC',quality:'GOOD'
}));
test('licensed, ordered source OHLC calculates true ranges and Wilder ATR',()=>{
 const bars=validateBacktestBars(base,{permission});
 assert.equal(bars.length,7);
 const ranges=trueRanges(bars);assert.equal(ranges[0],4);
 const atr=atrWilder(bars,3);assert.equal(atr[0],null);
 assert.ok(atr[2]>0)
});
test('ATR-vs-PCT comparison returns only reference paper results',()=>{
 const r=backtestTrailing({bars:base,permission});
 assert.equal(r.paperOnly,true);
 assert.equal(r.sourceDataKind,'LICENSED_PROVIDER_OHLC');
 assert.equal(r.atr.mode,'ATR');assert.equal(r.fixedPercent.mode,'PCT');
 assert.equal(r.atr.executionPriceGuaranteed,false)
});
test('no fake source, no unauthorized historical reuse',()=>{
 assert.throws(()=>backtestTrailing({bars:base}),/UNLICENSED/);
 assert.throws(()=>backtestTrailing({bars:base.map(x=>({...x,origin:'PRICE_POINTS'})),permission}),/Unverified OHLC/);
});
test('repeated or out-of-order time and implausible OHLC are blocked',()=>{
 assert.throws(()=>validateBacktestBars([base[0],base[0],...base.slice(2)],{permission}),/chronology/);
 assert.throws(()=>validateBacktestBars(base.map((x,i)=>i===2?{...x,low:400}:x),{permission}),/inconsistent/);
});
test('refuses wrong buy/sell side for hypothetical long and short exit',()=>{
 assert.throws(()=>backtestTrailing({bars:base,permission,position:'SHORT'}),/QUOTE_SIDE/);
 assert.doesNotThrow(()=>backtestTrailing({bars:base.map(x=>({...x,side:'BUY'})),permission,position:'SHORT'}))
});
test('price gap through stop returns OPEN as conservative reference without execution guarantee',()=>{
 const bars=base.map((b,i)=>i===3?{...b,open:80,low:79,high:105,close:101}:b);
 const r=backtestTrailing({bars,permission,atrPeriod:3,fixedPct:3});
 assert.equal(r.fixedPercent.exit?.gapAtOpen,true);
 assert.equal(r.fixedPercent.exit?.referenceExit,80)
});
test('rejects invalid configuration and false OHLC high/low',()=>{
 assert.throws(()=>backtestTrailing({bars:base,permission,fixedPct:101}),/configuration/);
 assert.throws(()=>backtestTrailing({bars:base,permission,entryIndex:0}),/entryIndex/);
 assert.throws(()=>validateBacktestBars(base.map((x,i)=>i===1?{...x,high:40}:x),{permission}),/inconsistent/)
});
