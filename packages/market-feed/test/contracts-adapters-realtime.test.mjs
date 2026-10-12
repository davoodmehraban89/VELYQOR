import test from "node:test";
import assert from "node:assert/strict";
import {canonicalReferencePoint,canonicalSourceCandle,DATA_KIND,mayPublish,transportFrame} from "../src/contracts.mjs";
import {parseCoinGeckoMarketChart,parseBinanceSpotKlines,parseYfinanceResearchBars,planCoinGeckoHourlyRanges,PROVIDER_REGISTRY} from "../src/adapters.mjs";
import {createRealtimeSequenceGuard,validateSubscribeCommand,validateRealtimeEvent} from "../src/realtime-protocol.mjs";
// These are deliberately synthetic unit-test fixtures, NEVER production prices.
const receivedAt="2026-10-12T00:10:00Z";
const fixtureBase={symbol:"BTC_USD",source:"binance",unit:"USD_PER_BTC",quality:"DEGRADED",licenseEvidence:"test-contract-only",
 rights:"research_only",sourceTimestamp:"2025-10-10T01:00:00Z",receivedAt};
const point={...fixtureBase,source:"coingecko",dataKind:DATA_KIND.REFERENCE,price:"120.50"};
const candle={...fixtureBase,dataKind:DATA_KIND.CANDLE,timeframe:"1h",openTime:"2025-10-10T00:00:00Z",
 closeTime:"2025-10-10T01:00:00Z",timezone:"UTC",open:"120",high:"130",low:"115",close:"127",volume:"0.00"};
test("canonical reference points never acquire fake OHLC or volume",()=>{
 const p=canonicalReferencePoint(point);
 assert.equal(p.price,"120.50");
 assert.equal(p.open,undefined);assert.equal(p.high,undefined);assert.equal(p.volume,undefined);
 assert.equal(p.rights,"research_only");assert.equal(mayPublish(p),false);
});
test("source OHLC preserves exact volume zero, timestamps and disallows impossible bars",()=>{
 const bar=canonicalSourceCandle(candle);
 assert.equal(bar.volume,"0.00");
 assert.equal(bar.openTime,"2025-10-10T00:00:00.000Z");
 assert.throws(()=>canonicalSourceCandle({...candle,low:"140"}),/OHLC ordering/);
 assert.throws(()=>canonicalSourceCandle({...candle,sourceTimestamp:"2027-10-10T01:00:00Z"}),/future/);
 assert.throws(()=>canonicalSourceCandle({...point,dataKind:"source_ohlc"}),/unsupported timeframe/);
});
test("CoinGecko markets chart is point-only, never synthesized candle data",()=>{
 const points=parseCoinGeckoMarketChart({prices:[[1760058000000,250.5],[1760054400000,249.7]],total_volumes:[[1760058000000,10]]},
 {symbol:"BTC_USD",unit:"USD_PER_BTC",coinId:"bitcoin",receivedAt,rights:"research_only",licenseEvidence:"coingecko-test-only"});
 assert.equal(points.length,2);
 assert(points.every(p=>p.dataKind==="reference_point"&&p.open===undefined&&p.volume===undefined));
 assert.equal(points[0].quality,"DEGRADED");
 assert(points[0].sourceTimestamp<points[1].sourceTimestamp);
});
test("CoinGecko duplicate/NaN/invalid mapping fails closed",()=>{
 const opts={symbol:"BTC_USD",unit:"USD_PER_BTC",coinId:"bitcoin",receivedAt,licenseEvidence:"coingecko-test-only"};
 assert.throws(()=>parseCoinGeckoMarketChart({prices:[[1760058000000,100],[1760058000000,101]]},opts),/Duplicate/);
 assert.throws(()=>parseCoinGeckoMarketChart({prices:[[1760058000000,-1]]},opts),/invalid/);
 assert.throws(()=>parseCoinGeckoMarketChart({prices:[]},{...opts,coinId:"../../etc"}),/CoinGecko ID/);
});
test("one-year hourly CoinGecko planning is chunked into ≤100 day REST windows",()=>{
 const a=Date.UTC(2025,9,10),b=Date.UTC(2026,9,10);
 const ranges=planCoinGeckoHourlyRanges({startMs:a,endMs:b});
 assert.equal(ranges.length,4);
 for(const r of ranges)assert(r.to-r.from<=100*86400);
 assert.equal(ranges[0].from,Math.floor(a/1000));
 assert.equal(ranges.at(-1).to,Math.floor(b/1000));
});
test("Binance kline normalizer retains provider OHLC, volume and venue",()=>{
 const t=Date.UTC(2025,9,10,0);
 const result=parseBinanceSpotKlines([[t,"120","130","110","125","0",t+3600000-1]],
 {symbol:"BTC_USD",unit:"USD_PER_BTC",receivedAt,licenseEvidence:"binance-test-only",interval:"1h"});
 assert.equal(result.length,1);
 assert.equal(result[0].open,"120");
 assert.equal(result[0].volume,"0");
 assert.equal(result[0].closeTime,new Date(t+3600000).toISOString());
 assert.equal(result[0].source,"binance");
 assert.equal(result[0].rights,"research_only");
 assert.equal(mayPublish(result[0]),false);
});
test("Binance mismatched timeframe fails rather than resampling synthetic OHLC",()=>{
 const t=Date.UTC(2025,9,10,0);
 assert.throws(()=>parseBinanceSpotKlines([[t,"1","2","1","2","3",t+1000]],
 {symbol:"BTC_USD",unit:"USD_PER_BTC",receivedAt,licenseEvidence:"binance-test-only",interval:"1h"}),/not aligned/);
});
test("yfinance bridge is explicitly research-only and cannot be published",()=>{
 const r=parseYfinanceResearchBars([{openTime:"2025-10-10T00:00:00Z",closeTime:"2025-10-11T00:00:00Z",open:"5",high:"6",low:"4",close:"5",volume:null}],
 {symbol:"AAPL_USD",unit:"USD_PER_SHARE",receivedAt,licenseEvidence:"test-yahoo-research-only",timezone:"America/New_York"});
 assert.equal(r[0].rights,"research_only");
 assert.equal(mayPublish(r[0]),false);
 assert.equal(PROVIDER_REGISTRY.bonbast.launch,"blocked_pending_contract");
});
test("only reviewed approved_public source records can form outbound WS messages",()=>{
 const licensed=canonicalSourceCandle({...candle,rights:"approved_public"});
 const f=transportFrame(licensed,1,receivedAt);
 assert.equal(f.type,"market.update");assert.equal(f.payload.symbol,"BTC_USD");
 assert.equal(f.payload.licenseEvidence,undefined);
 assert.equal(f.payload.rights,undefined);
 assert.equal(f.payload.receivedAt,undefined);
 assert.throws(()=>transportFrame(canonicalSourceCandle(candle),1,receivedAt),/unlicensed/);
 assert.throws(()=>transportFrame(licensed,0,receivedAt),/sequence/);
});
test("subscription schema rejects abusive arrays/duplicates/unknown fields",()=>{
 const subscribe={type:"subscribe",version:1,symbols:["BTC_USD"],timeframe:"1h"};
 assert.deepEqual(validateSubscribeCommand(JSON.stringify(subscribe)),subscribe);
 for(const message of [{...subscribe,symbols:["BTC_USD","BTC_USD"]},{...subscribe,symbols:[]},{...subscribe,timeframe:"7s"},{...subscribe,sql:"SELECT *"}]){
  assert.throws(()=>validateSubscribeCommand(JSON.stringify(message)));
 }
});
test("realtime sequence guard detects gaps and rejects stale events without inventing prices",()=>{
 const make=(n)=>transportFrame(canonicalSourceCandle({...candle,rights:"approved_public"}),n,receivedAt);
 const g=createRealtimeSequenceGuard();
 assert.deepEqual(g.consume(make(1)),{accepted:true,recover:false,reason:"ok"});
 assert.equal(g.consume(make(1)).accepted,false);
 const gap=g.consume(make(3));
 assert.equal(gap.accepted,true);assert.equal(gap.recover,true);
 assert.equal(gap.reason,"sequence_gap");
 assert.equal(validateRealtimeEvent(make(4)).sequence,4);
});
