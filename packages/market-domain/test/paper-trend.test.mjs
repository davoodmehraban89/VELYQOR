import test from 'node:test';
import assert from 'node:assert/strict';
import {openPaperPosition,markPaperPosition} from '../src/paper-position.mjs';
import {analyzePaperTrend,initialPaperRiskReward} from '../src/paper-trend.mjs';
const cfg={symbol:'XAU_USD',entryPrice:100,capital:1000,side:'LONG',
 stopLossPercent:1.2,takeProfitPercent:2,trailingStopPercent:null,at:'2026-10-14T00:00:00Z'};
function make(moves=[]){
 let p=openPaperPosition({...cfg,takeProfitPercent:40,stopLossPercent:30});
 moves.forEach((price,i)=>{p=markPaperPosition(p,{price,at:new Date(Date.parse(cfg.at)+(i+1)*1000).toISOString()})});
 return p;
}
test('five observations required, not fabricated from historical reference line',()=>{
 const x=analyzePaperTrend(make([101,102]));
 assert.equal(x.status,'INSUFFICIENT_SCENARIO_DATA');
 assert.equal(x.classification,'UNDETERMINED');
 assert.equal(x.sampleCount,3);
});
test('detects clearly rising fictional scenario',()=>{
 const x=analyzePaperTrend(make([101,102,103,104]));
 assert.equal(x.classification,'UP');
 assert.ok(x.fastSma>x.slowSma);assert.ok(x.momentumPercent>0);
});
test('detects clearly falling fictional scenario',()=>{
 const x=analyzePaperTrend(make([99,98,97,96]));
 assert.equal(x.classification,'DOWN');
 assert.ok(x.fastSma<x.slowSma);assert.ok(x.momentumPercent<0);
});
test('flat fictional scenario is sideways, never directional',()=>{
 const x=analyzePaperTrend(make([100,100,100,100]));
 assert.equal(x.classification,'SIDEWAYS');
 assert.equal(x.momentumPercent,0);
});
test('calculates initial gross risk/reward independent of later trailing stop',()=>{
 const p=openPaperPosition(cfg);
 assert.ok(Math.abs(initialPaperRiskReward(p)-2/1.2)<1e-10);
});
test('rejects absent or malicious state',()=>{
 assert.throws(()=>analyzePaperTrend({}),/required/);
 assert.throws(()=>initialPaperRiskReward({}),/invalid/);
});
