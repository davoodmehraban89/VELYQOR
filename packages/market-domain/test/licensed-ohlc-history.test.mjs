import test from "node:test";
import assert from "node:assert/strict";
import {preflightOhlcHistory} from "../src/licensed-ohlc-history.mjs";
// Synthetic values below are UNIT TEST FIXTURES ONLY; never ingest these prices.
const base={
  providerCode:"test_provider",symbol:"USD_IRT_FREE",timeframe:"1d",
  rawUnit:"IRR_PER_USD",canonicalUnit:"IRT_PER_USD",timeZone:"Asia/Tehran",
  intendedUse:"public_api",from:"2025-10-01",to:"2026-10-11",receivedAt:"2026-10-11T20:00:00Z",
  license:{providerCode:"test_provider",status:"approved",evidenceRef:"test/evidence/only",
    reviewedBy:"fixture-reviewer",reviewedAt:"2025-10-01T10:00:00Z",
    rights:{commercialStorage:true,publicRedistribution:true}}
};
const sample=(date,override={})=>({providerCode:"test_provider",symbol:"USD_IRT_FREE",dataKind:"source_ohlc",
 sessionDate:date,openTime:date+"T00:00:00+03:30",closeTime:date+"T23:00:00+03:30",
 open:"1200000.0",high:"1250000.0",low:"1190000.0",close:"1210000.0",...override});
const run=(rows,other={})=>preflightOhlcHistory({...base,rows,...other});
test("approved commercially distributable OHLC normalizes IRR to IRT without invented volume",()=>{
 const r=run([sample("2025-10-13"),sample("2025-10-14")],{isSessionDay:()=>true});
 assert.deepEqual(r.candles.map(x=>[x.open,x.high,x.low,x.close,x.volume]),[
 ["120000","125000","119000","121000",null],
 ["120000","125000","119000","121000",null]]);
 assert.equal(r.candles[0].unit,"IRT_PER_USD");
 assert.equal(r.audit.gapsFilled,0);assert.equal(r.audit.annualCoverageMet,false);
 assert.equal(r.audit.readyForAnnualPublication,false);
});
test("no license, unpublished or unauthorized commercial reuse fails closed",()=>{
 for(const license of [null,{...base.license,status:"pending"},{...base.license,rights:{commercialStorage:true,publicRedistribution:false}},{...base.license,rights:{commercialStorage:false,publicRedistribution:true}}]){
  assert.throws(()=>run([sample("2025-10-13")],{license}),/Licensed|authorized/);
 }
});
test("internal-only license can stage but cannot publish",()=>{
 const license={...base.license,rights:{commercialStorage:true,publicRedistribution:false}};
 const result=run([sample("2025-10-13")],{license,intendedUse:"internal_storage"});
 assert.equal(result.candles.length,1);
 assert.equal(result.intendedUse,"internal_storage");
});
test("expired license rejected, future review rejected",()=>{
 assert.throws(()=>run([],{license:{...base.license,expiresAt:"2026-10-01T00:00:00Z"}}),/Expired/);
 assert.throws(()=>run([],{license:{...base.license,reviewedAt:"2027-10-01T00:00:00Z"}}),/Future/);
});
test("cannot relabel daily reference observation as a traded candle",()=>{
 assert.throws(()=>run([sample("2025-10-13",{dataKind:"daily_reference_point_not_ohlc"})]),/Reject reference/);
 assert.throws(()=>run([sample("2025-10-13",{symbol:"EUR_USD_ECB"})]),/mismatched/);
});
test("OHLC ordering, time zone, future intervals and naive times are rejected",()=>{
 assert.throws(()=>run([sample("2025-10-13",{low:"1260000"})]),/OHLC ordering/);
 assert.throws(()=>run([sample("2025-10-13",{openTime:"2025-10-13T00:00:00Z"})]),/Timezone\/session mismatch/);
 assert.throws(()=>run([sample("2025-10-13",{openTime:"2025-10-13T00:00:00"})]),/timezone offset/);
 assert.throws(()=>run([sample("2025-10-13",{closeTime:"2027-10-13T23:00:00+03:30"})]),/future bar/);
});
test("deduplicates exact OHLC and rejects conflicting provider revision",()=>{
 const row=sample("2025-10-13");
 const result=run([row,{...row,sourceRecordId:"different-audit-row"}]);
 assert.equal(result.candles.length,1);assert.equal(result.audit.duplicates,1);
 assert.throws(()=>run([row,{...row,close:"1230000"}]),/Conflicting duplicate/);
});
test("sorts shuffled provider records but records arrival-order defect",()=>{
 const result=run([sample("2025-10-15"),sample("2025-10-13"),sample("2025-10-14")]);
 assert.deepEqual(result.candles.map(x=>x.sessionDate),["2025-10-13","2025-10-14","2025-10-15"]);
 assert.equal(result.audit.outOfOrder,1);
});
test("does not manufacture missing sessions and distinguishes calendar availability",()=>{
 const a=sample("2025-10-13"),b=sample("2025-10-16");
 const unknown=run([a,b]);
 assert.equal(unknown.audit.maxCalendarGapDays,3);
 assert.equal(unknown.audit.calendarVerified,false);
 const known=run([a,b],{isSessionDay:()=>true});
 assert.equal(known.audit.missingExpectedSessions,2);
 assert.equal(known.audit.gapsFilled,0);
 assert.equal(known.candles.length,2);
});
test("full-year coverage is not implied by 254 observations unless dates and calendar support it",()=>{
 const two=run([sample("2025-10-13"),sample("2026-10-09")],{isSessionDay:()=>false});
 assert.equal(two.audit.coverageDays,362);
 assert.equal(two.audit.annualCoverageMet,false);
 assert.equal(two.audit.readyForAnnualPublication,false);
});
test("rejects undocumented unit pairs and excessive precision before persistence",()=>{
 assert.throws(()=>run([],{canonicalUnit:"USD_PER_BTC"}),/Undocumented/);
 assert.throws(()=>run([sample("2025-10-13",{close:"1210000.1234567890"})]),/precision/);
 assert.throws(()=>run([sample("2025-10-13",{volume:"0"})]),/positive/);
});
