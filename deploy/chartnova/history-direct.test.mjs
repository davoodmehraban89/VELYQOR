import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
const today="2026-10-11";
const secret="postgresql://reader:fakepassword@ep-test.aws.neon.tech/neondb?sslmode=require";
function env(){const kv=new Map();return {CHARTNOVA_HISTORY_DATABASE_URL:secret,MARKET_CACHE:{get:async(k,t)=>{const v=kv.get(k);return t==="json"&&v?JSON.parse(v):v??null},put:async(k,v)=>kv.set(k,v)}}}
function request(query){return new Request("https://app.chartnova.ir/api/history"+query)}
const p="EUR_USD_ECB";
test("invalid dates, future dates, unknown fields, oversized limits and symbols are rejected before reading database",async()=>{
 const e=env();
 for(const suffix of ["?from=2026-02-30","?from=2026-10-10&to=2025-10-11","?from=2020-01-01&to=2026-10-11","?limit=501","?limit=0","?limit=1.5","?to=2099-01-01","?foo=bar","?symbol=../../etc/passwd"]){
   const response=await worker.fetch(request(suffix),e);
   assert.equal(response.status,400,suffix);
 }
});
test("readonly direct Neon query is parameterized, bounded and never discloses the credential",async()=>{
 const e=env(),nativeFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{
   calls++;
   assert.equal(url,"https://ep-test.aws.neon.tech/sql");
   assert.equal(init.headers["Neon-Connection-String"],secret);
   const body=JSON.parse(init.body);
   assert.match(body.query,/public\.chartnova_history_public/);
   assert.match(body.query,/LIMIT \$4::integer/);
   assert.deepEqual(body.params,[p,"2026-10-08T00:00:00Z","2026-10-11T00:00:00.000Z",2]);
   return Response.json({rows:[
    {symbol:p,quote_asset:"USD",source:"ecb_exr",observation_at:"2026-10-09T23:59:59Z",price:"1.1206",quality:"GOOD",flags:{data_kind:"daily_reference_point_not_ohlc",observation_date:"2026-10-09"}},
    {symbol:p,quote_asset:"USD",source:"ecb_exr",observation_at:"2026-10-08T23:59:59Z",price:"1.1208",quality:"GOOD",flags:{data_kind:"daily_reference_point_not_ohlc",observation_date:"2026-10-08"}}
   ]});
 };
 try{
   const r=await worker.fetch(request("?symbol=EUR_USD_ECB&from=2026-10-08&to=2026-10-10&limit=2"),e);
   assert.equal(r.status,200);
   const d=await r.json();
   assert.equal(d.count,2);assert.equal(d.dataKind,"daily_reference_point_not_ohlc");
   assert.deepEqual(d.series.map(x=>x.date),["2026-10-08","2026-10-09"]);
   assert(!JSON.stringify(d).includes("fakepassword"));assert(!JSON.stringify(d).includes("postgresql://"));
   assert.equal(calls,1);
   const again=await worker.fetch(request("?symbol=EUR_USD_ECB&from=2026-10-08&to=2026-10-10&limit=2"),e);
   assert.equal(again.status,200);assert.equal(calls,1,"cached API must not refetch Postgres on repeat");
 }finally{globalThis.fetch=nativeFetch}
});
test("database error fails closed without returning a secret",async()=>{
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response("connection failed", {status:503});
 try{
  const response=await worker.fetch(request("?symbol=EUR_USD_ECB&from=2026-10-08&to=2026-10-10"),env());
  assert.equal(response.status,503);
  const body=await response.text();
  assert(!body.includes("fakepassword"));assert(!body.includes("postgresql://"));
 }finally{globalThis.fetch=nativeFetch}
});
