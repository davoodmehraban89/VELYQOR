import test from "node:test";
import assert from "node:assert/strict";
import {serveHistoryV2} from "../src/history-api.mjs";
import {normalizeHistoryResponse} from "../src/chart-adapter.mjs";
// Synthetic isolated fixtures, not real prices nor redistributable vendor data.
const request=(params)=>new Request("https://staging.invalid/api/v2/history?"+new URLSearchParams(params));
const params={
 symbol:"BTC_USD",dataKind:"source_ohlc",timeframe:"1h",
 from:"2026-10-08",to:"2026-10-10",limit:"10",
};
test("provider-neutral licensed REST response can be consumed by Lightweight Charts candle adapter",async()=>{
 const res=await serveHistoryV2(request(params),{lookup:async()=>({
  source:"fixture_provider",rights:"approved_public",dataKind:"source_ohlc",attribution:"Test fixture",unit:"USD_PER_BTC",
  rows:[{symbol:"BTC_USD",unit:"USD_PER_BTC",timeframe:"1h",openTime:"2026-10-09T10:00:00Z",closeTime:"2026-10-09T11:00:00Z",
   open:"101",high:"106",low:"99",close:"104",volume:"0",quality:"GOOD"}]
 })});
 assert.equal(res.status,200);
 const data=await res.json(),normalized=normalizeHistoryResponse(data,"BTC_USD");
 assert.equal(normalized.kind,"candle");
 assert.equal(normalized.data[0].time,Date.parse("2026-10-09T10:00:00Z")/1000);
 assert.equal(normalized.data[0].close,104);
});
test("provider-neutral daily reference time/price cannot become OHLC",async()=>{
 const res=await serveHistoryV2(request({...params,symbol:"EUR_USD_ECB",dataKind:"reference_point",timeframe:"1d"}),{lookup:async()=>({
  source:"fixture_reference",rights:"approved_public",dataKind:"reference_point",attribution:"Test fixture",unit:"USD_PER_EUR",
  rows:[{symbol:"EUR_USD_ECB",unit:"USD_PER_EUR",sourceTimestamp:"2026-10-09T14:00:00Z",price:"1.16",quality:"GOOD"}]
 })});
 assert.equal(res.status,200);
 const out=normalizeHistoryResponse(await res.json(),"EUR_USD_ECB");
 assert.equal(out.kind,"reference");
 assert.deepEqual(out.data,[{time:"2026-10-09",value:1.16}]);
});
