import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
const url=(q)=>new Request("https://app.chartnova.ir/api/history"+q);
function fixtureEnv(){
 const snapshot={
  ok:true,symbol:"EUR_USD_ECB",dataKind:"daily_reference_point_not_ohlc",source:"ECB",
  quoteCurrency:"USD",fetchedAt:"2026-10-11T12:00:00Z",
  internalCredential:"postgresql://do-not-expose",qualitySource:"do-not-expose",
  series:[{date:"2026-10-09",close:1.12,quality:"GOOD",internalCredential:"do-not-expose"},{date:"2026-10-08",close:1.11,quality:"GOOD"}]
 };
 // Correct ascending ordering as required for a valid series.
 snapshot.series.reverse();
 const kv=new Map([["history:ecb:EUR_USD_ECB:1y",JSON.stringify(snapshot)]]);
 return {MARKET_CACHE:{get:async(k,format)=>format==="json"?JSON.parse(kv.get(k)??"null"):kv.get(k)??null}};
}
test("history response never leaks unknown fields from KV snapshots",async()=>{
 const r=await worker.fetch(url("?symbol=EUR_USD_ECB&from=2026-10-08&to=2026-10-10"),fixtureEnv());
 assert.equal(r.status,200);
 const body=await r.text();
 assert(!body.includes("internalCredential"));
 assert(!body.includes("do-not-expose"));
 assert(!body.includes("postgresql://"));
 const json=JSON.parse(body);
 assert.equal(json.count,2);
 assert.equal(json.dataKind,"daily_reference_point_not_ohlc");
 assert.deepEqual(Object.keys(json.series[0]).sort(),["close","date","quality"]);
});
test("duplicated or empty query parameters rejected instead of silently ignored",async()=>{
 for(const q of ["?symbol=EUR_USD_ECB&symbol=EUR_GBP_ECB","?symbol=","?from=","?to=","?limit=1&limit=2"]){
  const r=await worker.fetch(url(q),fixtureEnv());
  assert.equal(r.status,400,q);
 }
});
test("empty date window is not misreported as a valid historical series",async()=>{
 const r=await worker.fetch(url("?symbol=EUR_USD_ECB&from=2026-07-01&to=2026-07-03"),fixtureEnv());
 assert.equal(r.status,503);
 assert.equal((await r.json()).ok,false);
});
