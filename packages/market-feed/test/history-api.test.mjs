import test from "node:test";
import assert from "node:assert/strict";
import {parseHistoryRequest,serveHistoryV2} from "../src/history-api.mjs";
const root="https://app.chartnova.ir/api/v2/history";
const req=(query,method="GET")=>new Request(root+query,{method});
const common="?symbol=BTC_USD&from=2025-10-10&to=2026-10-10&dataKind=source_ohlc&timeframe=1h&limit=2";
const row=(t)=>({
 symbol:"BTC_USD",unit:"USD_PER_BTC",timeframe:"1h",openTime:t,closeTime:new Date(Date.parse(t)+3600000).toISOString(),
 open:"100.0",high:"101.0",low:"99.0",close:"100.5",volume:"0",quality:"DEGRADED",secretProviderToken:"NOT_FOR_PUBLIC"
});
const response=(rows)=>({source:"binance",unit:"USD_PER_BTC",dataKind:"source_ohlc",rights:"approved_public",attribution:"Binance Exchange test fixture only",rows});
test("date, symbol, kind, limit, unknown parameter and duplicate input validation",()=>{
 const valid=parseHistoryRequest(new URL(root+common));assert.equal(valid.limit,2);
 const malformed=[
 "?symbol=BTC_USD&from=2025-10-10&to=2026-10-10&dataKind=source_ohlc&timeframe=1h&limit=6000",
 common+"&symbol=ETH_USD",common+"&extra=SQL",common.replace("BTC_USD","../../root"),
 common.replace("source_ohlc","made_up"),common.replace("from=2025-10-10","from=2020-01-01"),
 common+"&cursor=garbage",common.replace("2025-10-10","2025-13-10")];
 for(const q of malformed)assert.throws(()=>parseHistoryRequest(new URL(root+q)),undefined,q);
});
test("unconfigured provider-neutral history never claims live data",async()=>{
 const r=await serveHistoryV2(req(common));
 assert.equal(r.status,503);assert.equal((await r.json()).error,"storage_not_configured");
});
test("read-only repository port returns descending page in ascending presentation with cursor",async()=>{
 const dates=["2025-10-12T01:00:00Z","2025-10-12T00:00:00Z","2025-10-11T23:00:00Z"];
 let called;
 const r=await serveHistoryV2(req(common),{lookup:async(query)=>{called=query;return response(dates.map(row))}});
 assert.equal(r.status,200);
 const json=await r.json();
 assert.equal(json.series.length,2);assert.equal(json.page.hasMore,true);
 assert.equal(json.page.nextCursor,dates[1]);
 assert.equal(json.series[0].time,dates[1]);assert.equal(json.series[1].time,dates[0]);
 assert.equal(json.series[0].volume,0);
 assert(!JSON.stringify(json).includes("NOT_FOR_PUBLIC"));
 assert.equal(called.symbol,"BTC_USD");assert.equal(called.limit,2);
});
test("unknown license rights or empty data rejected instead of silently rendered",async()=>{
 const a=await serveHistoryV2(req(common),{lookup:async()=>({...response([row("2025-10-11T00:00:00Z")]),rights:"research_only"})});
 assert.equal(a.status,503);
 const b=await serveHistoryV2(req(common),{lookup:async()=>response([])});
 assert.equal(b.status,404);
});
test("cross-symbol, reversed order, excessive rows and invalid OHLC rejected",async()=>{
 const t="2025-10-12T00:00:00Z";
 for(const rows of [
  [{...row(t),symbol:"ETH_USD"}],
  [row("2025-10-11T00:00:00Z"),row(t)],
  [{...row(t),low:"105"}],
  [row(t),row(t)],
  [row(t),row(t),row(t),row(t)]]
 ){
  const result=await serveHistoryV2(req(common),{lookup:async()=>response(rows)});
  assert.equal(result.status,502);
 }
});
test("CoinGecko-like point data cannot acquire OHLC fields",async()=>{
 const q="?symbol=BTC_USD&from=2025-10-10&to=2026-10-10&dataKind=reference_point&timeframe=1d";
 const ref={symbol:"BTC_USD",unit:"USD_PER_BTC",sourceTimestamp:"2025-10-10T00:00:00Z",price:120,quality:"DEGRADED"};
 const source={source:"coingecko",unit:"USD_PER_BTC",dataKind:"reference_point",rights:"approved_public",attribution:"research fixture",rows:[ref]};
 const a=await serveHistoryV2(req(q),{lookup:async()=>source});
 assert.equal(a.status,200);
 const json=await a.json();assert.equal(json.series[0].price,120);
 assert.equal(json.series[0].open,undefined);
 const b=await serveHistoryV2(req(q),{lookup:async()=>({...source,rows:[{...ref,open:110}]})});
 assert.equal(b.status,502);
});
test("method not allowed is explicit",async()=>{
 const r=await serveHistoryV2(req(common,"POST"));
 assert.equal(r.status,405);
});
