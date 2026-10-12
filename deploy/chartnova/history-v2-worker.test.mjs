import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

// No live credentials in this test; SQL results are TEST-ONLY mock observations.
const secret="postgresql://chartnova_history_ro:TEST_ONLY_SECRET@ep-example.aws.neon.tech/neondb?sslmode=require";
const query=new URLSearchParams({symbol:"EUR_USD_ECB",from:"2026-10-01",to:"2026-10-10",
 dataKind:"reference_point",timeframe:"1d",limit:"10"});
const endpoint="https://app.chartnova.ir/api/v2/history?"+query;
const env=(withSecret=false)=>({MARKET_CACHE:{get:async()=>null,put:async()=>{}},...(withSecret?{CHARTNOVA_HISTORY_DATABASE_URL:secret}:{})});
test("v2 URL is unavailable unless server-side restricted Neon credential is configured",async()=>{
 const r=await worker.fetch(new Request(endpoint),env());
 assert.equal(r.status,503);assert.equal((await r.json()).error,"history_storage_not_configured");
});
test("v2 URL rejects a superuser database connection",async()=>{
 const e=env(true);e.CHARTNOVA_HISTORY_DATABASE_URL=secret.replace("chartnova_history_ro","neondb_owner");
 const r=await worker.fetch(new Request(endpoint),e);
 assert.equal(r.status,503);
 assert(!JSON.stringify(await r.json()).includes("neondb_owner"));
});
test("v2 URL reads and sanitizes real-shape public ECB view observations",async()=>{
 const prior=globalThis.fetch;let dbCalls=0;
 globalThis.fetch=async(url,options)=>{
  dbCalls++;
  assert.equal(url,"https://ep-example.aws.neon.tech/sql");
  assert.equal(options.headers["Neon-Connection-String"],secret);
  return Response.json({rows:[{
    symbol:"EUR_USD_ECB",quote_asset:"USD",source:"ecb_exr",
    observation_at:"2026-10-09T23:59:59.000Z",price:"1.12",quality:"GOOD",
    flags:{source_series:"EXR.D.USD.EUR.SP00.A",license:"ECB/ESCB open statistics; attribution required",
      data_kind:"daily_reference_point_not_ohlc",observation_date:"2026-10-09",privateInternalField:"DO_NOT_PUBLISH"},
    fakeDatabaseToken:"DO_NOT_PUBLISH"
  }]});
 };
 try{
  const r=await worker.fetch(new Request(endpoint),env(true));
  assert.equal(r.status,200);
  const body=await r.text();
  assert(!body.includes("TEST_ONLY_SECRET"));assert(!body.includes("DO_NOT_PUBLISH"));
  const data=JSON.parse(body);
  assert.equal(data.dataKind,"reference_point");assert.equal(data.rights,"approved_public");
  assert.equal(data.count,1);assert.equal(data.series[0].price,1.12);
  assert.equal(dbCalls,1);
 }finally{globalThis.fetch=prior}
});
test("v2 endpoint never pretends ECB rates are OHLC",async()=>{
 const url=new URL(endpoint);url.searchParams.set("dataKind","source_ohlc");
 const r=await worker.fetch(new Request(url),env(true));
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"licensed_history_unavailable");
});
