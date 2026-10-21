import test from 'node:test';import assert from 'node:assert/strict';
import {inspectTwoSources} from '../src/licensed-provider-selector.mjs';
const t='2026-10-20T12:00:00Z',now=Date.parse(t),perm={publicDisplay:true,derivedAlerts:true};
const x={symbol:'USD_IRT_FREE',provider:'one',unit:'IRT_PER_USD',side:'SELL',price:1000,timestamp:t,permission:perm};
const y={...x,provider:'two',price:1001};
const run=(p,s,opts={})=>inspectTwoSources(p,s,{nowMs:now,maxClockSkewMs:60000,...opts});
test('same units/sides two independent licensed sources cross-check',()=>{
 const a=run(x,y);assert.equal(a.status,'CROSSCHECK_PASSED');assert.equal(a.confirmation,'TWO_MATCHING_SOURCES')
});
test('divergence blocks price output and returns difference',()=>{
 const r=run(x,{...y,price:1200});assert.equal(r.status,'SOURCE_DIVERGENCE');
 assert.equal(r.alertsSuspended,true);assert.equal(r.observation,null);assert.ok(r.divergencePct>2)
});
test('non-convertible raw units, side and time block, never silently normalize',()=>{
 for(const mismatch of [{unit:'IRR_PER_USD'},{side:'BUY'},{timestamp:'2026-10-20T11:58:00Z'},{provider:'one'}]){
  const r=run(x,{...y,...mismatch});assert.equal(r.alertsSuspended,true);
  assert.ok(['INCOMPATIBLE_SOURCES','SOURCE_TIME_SKEW'].includes(r.status))
 }
});
test('unlicensed primary uses licensed secondary with explicit single-source downgrade',()=>{
 const r=run({...x,permission:null},y);
 assert.equal(r.status,'FALLBACK_SINGLE_SOURCE');
 assert.equal(r.confirmation,'ONE_LICENSED_SOURCE_NO_CROSSCHECK');
});
test('no rights cannot select any price or license by implication',()=>{
 const r=run({...x,permission:{publicDisplay:false,derivedAlerts:true}},
  {...y,permission:null});assert.equal(r.status,'BOTH_UNAVAILABLE');
 assert.equal(r.observation,null)
});
test('stale both sources block and fresh single source may survive',()=>{
 const o={...x,timestamp:'2026-10-20T11:30:00Z'};
 assert.equal(run(o,{...y,timestamp:o.timestamp}).status,'BOTH_UNAVAILABLE');
 assert.equal(run(o,y).status,'FALLBACK_SINGLE_SOURCE')
});
test('rejects invalid configuration',()=>assert.throws(()=>run(x,y,{maxDivergencePct:-1})));
