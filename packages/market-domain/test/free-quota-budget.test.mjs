import test from 'node:test';import assert from 'node:assert/strict';
import {quotaBudget,officialFreePlanBudget} from '../src/free-quota-budget.mjs';
test('30 day navasan no-reserve arithmetic is precisely six hours',()=>{
 const r=officialFreePlanBudget('NAVASAN',{reserveFraction:0});
 assert.equal(r.mathematicallyMinimalMinutes,360);assert.equal(r.suggestedMinutes,360);
 assert.equal(r.plannedCalls,120);assert.equal(r.guaranteedLatencyMs,null)
});
test('31 day navasan floor 372 minutes',()=>assert.equal(officialFreePlanBudget('NAVASAN',{daysInMonth:31,reserveFraction:0}).mathematicallyMinimalMinutes,372));
test('Gheymat one-call floor 5.76 min, two-call doubles',()=>{
 assert.equal(officialFreePlanBudget('GHEYMAT_ONLINE',{reserveFraction:0}).mathematicallyMinimalMinutes,5.76);
 assert.equal(officialFreePlanBudget('GHEYMAT_ONLINE',{callsPerPoll:2,reserveFraction:0}).mathematicallyMinimalMinutes,11.52)
});
test('reserve never overcommits quota, including odd windows',()=>{
 for(const calls of [1,5,17,120,250]){
  for(const k of [1,2,4]){
   try{const x=quotaBudget({calls,windowMinutes:1440,callsPerPoll:k,reserveFraction:0});
    assert.ok(x.plannedCalls<=calls);assert.ok(x.remainingCalls>=0);
    assert.equal(x.latencyVerified,false);
   }catch(e){assert.ok(e instanceof RangeError)}
  }
 }
});
test('account/plan drift and unknown providers rejected, no asserted SLA',()=>{
 assert.throws(()=>officialFreePlanBudget('HIDDEN_PROVIDER'));
 assert.throws(()=>officialFreePlanBudget('NAVASAN',{daysInMonth:32}));
 assert.throws(()=>quotaBudget({calls:250,windowMinutes:1440,reserveFraction:1}));
});
