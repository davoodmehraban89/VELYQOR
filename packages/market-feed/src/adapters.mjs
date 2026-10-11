import {canonicalReferencePoint,canonicalSourceCandle,DATA_KIND} from "./contracts.mjs";
const requireApproved=(rights)=>{if(rights!=="approved_public"&&rights!=="research_only")throw Error("Provider rights unverified");};
const positiveDate=(x,label)=>{if(!Number.isSafeInteger(x)||x<=0)throw Error(label+" invalid epoch");return new Date(x).toISOString()};
const safeMapping=(symbol,unit,source,rights,licenseEvidence,receivedAt)=> {
 if(!symbol||!unit||!source||!receivedAt||!licenseEvidence)throw Error("Explicit provider mapping/provenance required");
 requireApproved(rights);return {symbol,unit,source,rights,licenseEvidence,receivedAt};
};
/**
 * CoinGecko market_chart is a set of market-price points, NOT OHLC.
 * The API's prices[] and total_volumes[] are independent timeseries. Never
 * invent opening/closing prices, trade volume, or exchange-specific bars.
 */
export function parseCoinGeckoMarketChart(payload,{symbol,unit,receivedAt,rights="research_only",licenseEvidence,coinId}){
 const base=safeMapping(symbol,unit,"coingecko",rights,licenseEvidence,receivedAt);
 if(!/^[a-z0-9-]{2,80}$/.test(coinId||""))throw Error("Invalid CoinGecko ID");
 if(!Array.isArray(payload?.prices))throw Error("CoinGecko prices[] missing");
 const seen=new Set();
 return payload.prices.map((p,i)=>{
  if(!Array.isArray(p)||p.length!==2)throw Error("Malformed CoinGecko point "+i);
  const when=positiveDate(p[0],"CoinGecko point");
  if(seen.has(when))throw Error("Duplicate CoinGecko timestamp");
  seen.add(when);
  return canonicalReferencePoint({...base,dataKind:DATA_KIND.REFERENCE,price:p[1],sourceTimestamp:when,
     venue:"coingecko_aggregated",quoteSide:"indicative"});
 }).sort((a,b)=>a.sourceTimestamp.localeCompare(b.sourceTimestamp));
}
/** Request planning only. Actual Demo API entitlement/rate restrictions are checked by the caller. */
export function planCoinGeckoHourlyRanges({startMs,endMs,maxDaysPerRequest=100}){
 if(!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||startMs>=endMs)throw Error("Invalid time range");
 if(!Number.isInteger(maxDaysPerRequest)||maxDaysPerRequest<1||maxDaysPerRequest>100)throw Error("Hourly request must not exceed 100 days");
 const range=[];let start=startMs;const span=maxDaysPerRequest*86400000;
 while(start<endMs){
  const end=Math.min(start+span,endMs);
  range.push({from:Math.floor(start/1000),to:Math.floor(end/1000)});
  start=end;
  if(range.length>64)throw Error("Too many request windows");
 }
 return range;
}
/**
 * Binance SPOT klines are genuine venue OHLC. closeTime is inclusive in
 * the wire format. Preserve its +1ms exclusive interval without fabricating.
 * This adapter performs no requests and cannot bypass access restrictions.
 */
export function parseBinanceSpotKlines(klines,{symbol,unit,receivedAt,rights="research_only",licenseEvidence,interval,venue="binance_spot"}){
 const base=safeMapping(symbol,unit,"binance",rights,licenseEvidence,receivedAt);
 const durations=Object.freeze({"1h":3600000,"1d":86400000,"1m":60000,"5m":300000,"15m":900000,"4h":14400000});
 if(!Object.hasOwn(durations,interval))throw Error("Unsupported Binance kline interval");
 if(!Array.isArray(klines))throw Error("Binance klines array missing");
 const seen=new Set();
 return klines.map((k,i)=>{
  if(!Array.isArray(k)||k.length<7)throw Error("Malformed Binance kline "+i);
  const [openEpoch,o,h,l,c,v,closeEpoch]=k;
  const begin=positiveDate(openEpoch,"openTime"),end=positiveDate(closeEpoch+1,"closeTime");
  if(closeEpoch+1-openEpoch!==durations[interval])throw Error("Binance interval not aligned");
  if(seen.has(begin))throw Error("Duplicate Binance open timestamp");
  seen.add(begin);
  return canonicalSourceCandle({...base,dataKind:DATA_KIND.CANDLE,openTime:begin,closeTime:end,sourceTimestamp:end,
    timeframe:interval,open:o,high:h,low:l,close:c,volume:v,timezone:"UTC",venue,quoteSide:"trade",quality:"DEGRADED"});
 }).sort((a,b)=>a.openTime.localeCompare(b.openTime));
}
/**
 * yfinance is an explicitly RESEARCH-ONLY adapter scaffold. Commercial
 * publishing remains blocked even if its API returns correctly shaped OHLC.
 * It intentionally does not fetch Yahoo in deployed ChartNova.
 */
export function parseYfinanceResearchBars(bars,{symbol,unit,receivedAt,licenseEvidence,timeframe="1d",timezone="America/New_York"}){
 const base=safeMapping(symbol,unit,"yfinance","research_only",licenseEvidence,receivedAt);
 if(!Array.isArray(bars))throw Error("yfinance research data missing");
 const seen=new Set();
 return bars.map((r,i)=>{
  if(!r||typeof r!=="object")throw Error("Invalid research bar "+i);
  if(seen.has(r.openTime))throw Error("Duplicate research timestamp");seen.add(r.openTime);
  return canonicalSourceCandle({...base,dataKind:DATA_KIND.CANDLE,timeframe,
   openTime:r.openTime,closeTime:r.closeTime,sourceTimestamp:r.closeTime,
   open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume??null,
   timezone,venue:"yahoo_research",quality:"DEGRADED",quoteSide:"trade"});
 }).sort((a,b)=>a.openTime.localeCompare(b.openTime));
}
export const PROVIDER_REGISTRY=Object.freeze({
 coingecko:Object.freeze({transport:"REST",dataKind:"reference_point",history:"market_chart/range",launch:"license_review_required"}),
 binance:Object.freeze({transport:"REST+WebSocket",dataKind:"source_ohlc",history:"api/v3/klines",launch:"geofencing_and_license_review"}),
 yfinance:Object.freeze({transport:"Python research bridge",dataKind:"source_ohlc",launch:"research_only"}),
 polygon:Object.freeze({transport:"WebSocket",dataKind:"provider_dependent",launch:"plan_and_entitlement_required"}),
 navasan:Object.freeze({transport:"REST",dataKind:"provider_dependent",launch:"license_and_unit_audit_required"}),
 bonbast:Object.freeze({transport:"not_verified",dataKind:"not_verified",launch:"blocked_pending_contract"}),
 ecb:Object.freeze({transport:"REST",dataKind:"reference_point",launch:"attribution_required"}),
});
