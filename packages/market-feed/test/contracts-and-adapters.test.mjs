import test from "node:test";
import assert from "node:assert/strict";
import {canonicalReferencePoint,canonicalSourceCandle,transportFrame,mayPublish} from "../src/contracts.mjs";
import {parseSubscriptions,parseClientMessage,safeStreamEnvelope} from "../src/stream-protocol.mjs";
import {coinGeckoRangeRequest,binanceKlinesRequest,providerCanPubliclyRedistribute} from "../src/providers.mjs";
import {normalizeHistoryResponse,normalizeStreamUpdate} from "../src/chart-adapter.mjs";

// Fictitious test-only values. No fixtures are market records.
const base={
 source:"test_provider",symbol:"BTC_USD",unit:"USD_PER_BTC",
 sourceTimestamp:"2026-09-01T10:00:00Z",receivedAt:"2026-09-01T10:00:01Z",
 quality:"GOOD",licenseEvidence:"test-only-evidence-ref",rights:"approved_public",
};
test("licensed point is a line, not a synthetic OHLC candle",()=>{
 const p=canonicalReferencePoint({...base,dataKind:"reference_point",price:"100"});
 assert.equal(p.price,"100");assert.equal(p.dataKind,"reference_point");
 assert.throws(()=>canonicalSourceCandle({...base,dataKind:"reference_point",open:"100",high:"102",low:"98",close:"100",openTime:base.sourceTimestamp,closeTime:base.receivedAt,timeframe:"1h",timezone:"UTC"}),/source OHLC/);
 const frame=transportFrame(p,1,"2026-09-01T10:00:03Z");
 assert.equal(frame.payload.symbol,"BTC_USD");
 assert(!JSON.stringify(frame).includes("licenseEvidence"));
 assert(!JSON.stringify(frame).includes("test-only-evidence-ref"));
});
test("public stream cannot publish unapproved provider rights",()=>{
 const p=canonicalReferencePoint({...base,dataKind:"reference_point",price:"100",rights:"research_only"});
 assert.equal(mayPublish(p),false);
 assert.throws(()=>transportFrame(p,1,"2026-09-01T10:00:03Z"),/unlicensed/);
});
test("real provider OHLC preserves null volume rather than inventing it",()=>{
 const c=canonicalSourceCandle({...base,dataKind:"source_ohlc",timeframe:"1h",timezone:"UTC",
  openTime:"2026-09-01T10:00:00Z",closeTime:"2026-09-01T11:00:00Z",
  open:"100",high:"102",low:"99",close:"101"});
 assert.equal(c.volume,null);
 assert.throws(()=>canonicalSourceCandle({...c,high:"99"}),/OHLC/);
});
test("subscription input has bounded allowed symbols and rejects client publish",()=>{
 assert.deepEqual(parseSubscriptions("BTC_USD,EUR_USD_ECB,BTC_USD"),["BTC_USD","EUR_USD_ECB"]);
 assert.throws(()=>parseSubscriptions("../../secret"),/invalid/);
 assert.throws(()=>parseSubscriptions(Array.from({length:20},()=> "BTC_USD").join(",")),/invalid/);
 assert.deepEqual(parseClientMessage(JSON.stringify({type:"stream.subscribe",version:1,symbols:["BTC_USD"]})).symbols,["BTC_USD"]);
 assert.throws(()=>parseClientMessage(JSON.stringify({type:"market.update",version:1})),/not supported/);
 assert.throws(()=>safeStreamEnvelope({type:"market.update",version:1,sequence:1,payload:{symbol:"ETH_USD",dataKind:"source_ohlc"}},["BTC_USD"]),/unsubscribed/);
});
test("CoinGecko API descriptor never calls points 'candles'; 90 day slice is bounded",()=>{
 const descriptor=coinGeckoRangeRequest({coinId:"bitcoin",startMs:Date.parse("2026-04-01T00:00:00Z"),endMs:Date.parse("2026-04-30T00:00:00Z")});
 assert.equal(descriptor.dataKind,"reference_point");assert.equal(descriptor.notCandles,true);
 assert.match(descriptor.url,/market_chart\/range/);
 assert.throws(()=>coinGeckoRangeRequest({coinId:"bitcoin",startMs:Date.parse("2025-01-01T00:00:00Z"),endMs:Date.parse("2026-01-01T00:00:00Z")}),/90-day/);
});
test("Binance request is bounded, generated but not assumed accessible/licensed",()=>{
 const d=binanceKlinesRequest({symbol:"BTCUSDT",interval:"1h",startMs:Date.parse("2026-09-01T00:00:00Z"),endMs:Date.parse("2026-09-03T00:00:00Z")});
 assert.equal(d.dataKind,"source_ohlc");
 assert.equal(d.needsNetworkProbe,true);
 assert.throws(()=>binanceKlinesRequest({symbol:"BTCUSDT",interval:"1h",startMs:Date.parse("2026-09-01T00:00:00Z"),endMs:Date.parse("2026-09-03T00:00:00Z"),limit:1001}),/limit/);
 assert.equal(providerCanPubliclyRedistribute("binance"),false);
});
test("charting refuses unapproved candles and accepts licensed source OHLC only",()=>{
 const ref=normalizeHistoryResponse({ok:true,symbol:"EUR_USD_ECB",dataKind:"daily_reference_point_not_ohlc",source:"ECB",quoteCurrency:"USD",series:[{date:"2026-10-08",close:1.1},{date:"2026-10-09",close:1.2}]},"EUR_USD_ECB");
 assert.equal(ref.kind,"reference");
 const payload={ok:true,symbol:"BTC_USD",dataKind:"source_ohlc",source:"test_provider",unit:"USD_PER_BTC",series:[{openTime:"2026-09-01T00:00:00Z",open:"100",high:"102",low:"99",close:"101"}]};
 assert.throws(()=>normalizeHistoryResponse(payload,"BTC_USD"),/unlicensed/);
 const candle=normalizeHistoryResponse({...payload,rights:"approved_public"},"BTC_USD");
 assert.equal(candle.kind,"candle");
 assert.equal(candle.data[0].close,101);
 const frame={version:1,type:"market.update",payload:{symbol:"BTC_USD",dataKind:"source_ohlc",timeframe:"1h",openTime:"2026-09-01T10:00:00Z",open:"100",high:"102",low:"99",close:"101"}};
 assert.equal(normalizeStreamUpdate(frame,"BTC_USD","candle").close,101);
 assert.equal(normalizeStreamUpdate(frame,"EUR_USD_ECB","candle"),null);
});
