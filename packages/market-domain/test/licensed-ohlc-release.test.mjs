import test from "node:test";
import assert from "node:assert/strict";
import {preflightOhlcHistory} from "../src/licensed-ohlc-history.mjs";
// All prices below are fictitious and TEST-ONLY.
const date=(utc)=>new Date(utc).toISOString().slice(0,10);
const receivedAt="2026-10-16T00:00:00Z";
const periodFrom="2025-10-13",periodTo="2026-10-14";
const row=(sessionDate)=>({
  symbol:"USD_IRT_FREE",providerCode:"fixture_source",dataKind:"source_ohlc",sessionDate,
  openTime:sessionDate+"T00:00:00+03:30",closeTime:sessionDate+"T23:30:00+03:30",
  open:"1200000",high:"1250000",low:"1190000",close:"1210000"
});
const license=(publicRedistribution)=>({
 providerCode:"fixture_source",status:"approved",evidenceRef:"fixtures/not-a-real-license",
 reviewedBy:"QA fixture",reviewedAt:"2025-10-10T10:00:00Z",
 rights:{commercialStorage:true,publicRedistribution}
});
const check=(rows,options={})=>preflightOhlcHistory({
 providerCode:"fixture_source",symbol:"USD_IRT_FREE",rawUnit:"IRR_PER_USD",canonicalUnit:"IRT_PER_USD",
 timeZone:"Asia/Tehran",from:periodFrom,to:periodTo,receivedAt,rows,license:license(true),
 ...options
});
test("even a 365+ calendar-day span fails the annual publication gate if requested sessions are missing",()=>{
 const report=check([row("2025-10-13"),row("2026-10-14")],{
  isSessionDay:(d)=>["2025-10-13","2025-10-14","2026-10-14"].includes(d)
 });
 assert(report.audit.coverageDays>=365);
 assert.equal(report.audit.annualCoverageMet,true);
 assert.equal(report.audit.missingWindowSessions,1);
 assert.equal(report.audit.readyForAnnualPublication,false);
});
test("internal-only license cannot pass public release gate even with full requested calendar coverage",()=>{
 const report=check([row("2025-10-13"),row("2026-10-14")],{
  intendedUse:"internal_storage",license:license(false),
  isSessionDay:(d)=>["2025-10-13","2026-10-14"].includes(d)
 });
 assert.equal(report.audit.missingWindowSessions,0);
 assert.equal(report.audit.readyForAnnualPublication,false);
});
test("a mocked calendar returning non-boolean is rejected as untrustworthy",()=>{
 assert.throws(()=>check([row("2025-10-13")],{isSessionDay:()=>"open"}),/non-boolean/);
});
test("unverified exchange-calendar information blocks annual release",()=>{
 const report=check([row("2025-10-13"),row("2026-10-14")]);
 assert.equal(report.audit.calendarVerified,false);
 assert.equal(report.audit.readyForAnnualPublication,false);
});
test("only full explicitly licensed and session-complete 365+ day input passes mechanical gate",()=>{
 const report=check([row("2025-10-13"),row("2026-10-14")],{
  isSessionDay:(d)=>["2025-10-13","2026-10-14"].includes(d)
 });
 assert.equal(report.audit.annualCoverageMet,true);
 assert.equal(report.audit.missingWindowSessions,0);
 assert.equal(report.audit.readyForAnnualPublication,true);
 // Passing this mechanical fixture test is not proof that any real vendor agreement exists.
});
