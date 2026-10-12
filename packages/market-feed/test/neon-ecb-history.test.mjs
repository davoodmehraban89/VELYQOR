import test from "node:test";
import assert from "node:assert/strict";
import {buildNeonEcbHistoryLookup} from "../src/neon-ecb-history.mjs";
import {serveHistoryV2} from "../src/history-api.mjs";
import {normalizeHistoryResponse} from "../src/chart-adapter.mjs";

// TEST-ONLY fixture prices and credentials. No real Neon password or fabricated production rates.
const fakeUrl="postgresql://chartnova_history_ro:FICTIONAL_TEST_PASSWORD@ep-example.aws.neon.tech/neondb?sslmode=require";
const flags=(day)=>({data_kind:"daily_reference_point_not_ohlc",observation_date:day,
  license:"ECB/ESCB open statistics; attribution required",source_series:"EXR.D.USD.EUR.SP00.A"});
const sample=(day,price)=>({symbol:"EUR_USD_ECB",quote_asset:"USD",source:"ecb_exr",
 observation_at:day+"T23:59:59.000Z",price,quality:"GOOD",flags:flags(day)});
const url=(other={})=>new Request("https://app.chartnova.ir/api/v2/history?"+
 new URLSearchParams({symbol:"EUR_USD_ECB",from:"2026-10-01",to:"2026-10-10",timeframe:"1d",
 dataKind:"reference_point",limit:"1",...other}));
test("view adapter is parameterized, serves oldest-last pagination and never leaks secret",async()=>{
 let statements=0,actualParams;
 const lookup=buildNeonEcbHistoryLookup({databaseUrl:fakeUrl,fetchImpl:async (endpoint,options)=>{
  statements++;
  assert.equal(endpoint,"https://ep-example.aws.neon.tech/sql");
  assert.equal(options.headers["Neon-Connection-String"],fakeUrl);
  const body=JSON.parse(options.body);actualParams=body.params;
  assert.equal(body.query.includes("public.chartnova_history_public"),true);
  assert.match(body.query,/symbol=\$1/);
  assert.match(body.query,/LIMIT \$5::integer/);
  assert(!/INSERT|DELETE|UPDATE|DROP|ALTER/i.test(body.query));
  return Response.json({rows:[sample("2026-10-09","1.12"),sample("2026-10-08","1.11")]});
 }});
 const response=await serveHistoryV2(url(),{lookup});
 assert.equal(response.status,200);
 const serialized=await response.text();
 assert.equal(serialized.includes("FICTIONAL_TEST_PASSWORD"),false);
 const payload=JSON.parse(serialized);
 assert.equal(payload.rights,"approved_public");
 assert.equal(payload.page.hasMore,true);
 assert.equal(payload.page.nextCursor,"2026-10-09T23:59:59.000Z");
 assert.deepEqual(actualParams,["EUR_USD_ECB","2026-10-01T00:00:00.000Z","2026-10-11T00:00:00.000Z",null,2]);
 const parsed=normalizeHistoryResponse(payload,"EUR_USD_ECB");
 assert.equal(parsed.kind,"reference");
 assert.deepEqual(parsed.data,[{time:"2026-10-09",value:1.12}]);
 assert.equal(statements,1);
});
test("unconfigured reader or privileged role never queries Neon",()=>{
 assert.throws(()=>buildNeonEcbHistoryLookup({databaseUrl:""}),/not_configured/);
 assert.throws(()=>buildNeonEcbHistoryLookup({databaseUrl:fakeUrl.replace("chartnova_history_ro","neondb_owner")}),/restricted_history_reader/);
 assert.throws(()=>buildNeonEcbHistoryLookup({databaseUrl:fakeUrl.replace("neon.tech","example.com")}),/not_configured/);
});
test("licensed v2 repository cannot turn ECB reference rows into OHLC",async()=>{
 let called=false;
 const lookup=buildNeonEcbHistoryLookup({databaseUrl:fakeUrl,fetchImpl:()=>{called=true;throw Error("should not fetch")}});
 const result=await serveHistoryV2(url({dataKind:"source_ohlc"}),{lookup});
 assert.equal(result.status,503);assert.equal(called,false);
});
test("provenance mismatch, untrusted source, excessive rows and wrong order are rejected",async()=>{
 const cases=[
  [{...sample("2026-10-09","1.12"),flags:{...flags("2026-10-09"),data_kind:"source_ohlc"}}],
  [{...sample("2026-10-09","1.12"),source:"unknown_provider"}],
  [{...sample("2026-10-09","1.12"),price:"-42"}],
  [sample("2026-10-08","1.11"),sample("2026-10-09","1.12")],
  [sample("2026-10-09","1.12"),sample("2026-10-08","1.11"),sample("2026-10-07","1.10")],
 ];
 for(const rows of cases){
  const lookup=buildNeonEcbHistoryLookup({databaseUrl:fakeUrl,fetchImpl:async()=>Response.json({rows})});
  const response=await serveHistoryV2(url(),{lookup});
  assert.equal(response.status,502,JSON.stringify(rows));
  assert.equal((await response.text()).includes("FICTIONAL_TEST_PASSWORD"),false);
 }
});
test("cursor is bound to SQL and rejects rows with equal timestamp",async()=>{
 const lookup=buildNeonEcbHistoryLookup({databaseUrl:fakeUrl,fetchImpl:async(_endpoint,{body})=>{
  const {params}=JSON.parse(body);
  assert.equal(params[3],"2026-10-09T23:59:59.000Z");
  return Response.json({rows:[sample("2026-10-09","1.12")]});
 }});
 const response=await serveHistoryV2(url({cursor:"2026-10-09T23:59:59.000Z"}),{lookup});
 assert.equal(response.status,502,"storage returning cursor-equal data must fail validation");
});
