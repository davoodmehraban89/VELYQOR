// ChartNova canonical transport contracts. No provider keys, network calls or sample market prices.
export const DATA_KIND = Object.freeze({
  REFERENCE: "reference_point",
  CANDLE: "source_ohlc",
});
export const QUALITY = Object.freeze(["GOOD", "DEGRADED", "STALE", "INVALID"]);
export const TIMEFRAMES = Object.freeze(["1m","5m","15m","30m","1h","4h","1d"]);
const assert = (cond, message) => { if (!cond) throw new Error(message); };
const decimals = (value, field, allowZero=false) => {
  const raw = typeof value === "number" ? String(value) : value;
  assert(typeof raw === "string" && /^(?:0|[1-9]\d{0,19})(?:\.\d{1,12})?$/.test(raw), field+": invalid decimal");
  const number = Number(raw);
  assert(Number.isFinite(number) && (allowZero ? number>=0 : number>0),field+": invalid value");
  return raw;
};
const ms = (time,field) => {
  assert(typeof time === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(time),field+": expected timezone-qualified ISO8601");
  const n=Date.parse(time);assert(Number.isFinite(n),field+": invalid time");return n;
};
const symbol=(x)=>assert(typeof x==="string"&&/^[A-Z0-9_]{3,48}$/.test(x),"invalid canonical symbol");
const source=(x)=>assert(typeof x==="string"&&/^[a-z][a-z0-9_]{1,39}$/.test(x),"invalid provider source");
function common(o) {
  assert(o && typeof o==="object"&&!Array.isArray(o),"invalid market record");
  symbol(o.symbol);source(o.source);
  assert(typeof o.unit==="string"&&/^[A-Z0-9_]{3,64}$/.test(o.unit),"missing/invalid canonical unit");
  assert(QUALITY.includes(o.quality),"quality must be explicit");
  assert(typeof o.sourceTimestamp==="string","sourceTimestamp required");
  ms(o.sourceTimestamp,"sourceTimestamp");
  assert(typeof o.receivedAt==="string","receivedAt required");
  ms(o.receivedAt,"receivedAt");
  assert(Date.parse(o.sourceTimestamp)<=Date.parse(o.receivedAt)+5*60_000,"provider timestamp is in the future");
  assert(typeof o.licenseEvidence==="string"&&o.licenseEvidence.trim().length>=8,"licenseEvidence required");
  assert(["research_only","approved_public","pending_review"].includes(o.rights),"explicit redistribution rights required");
}
export function canonicalReferencePoint(o) {
  common(o);assert(o.dataKind===DATA_KIND.REFERENCE,"reference point kind required");
  return Object.freeze({
    dataKind:o.dataKind,symbol:o.symbol,source:o.source,unit:o.unit,
    price:decimals(o.price,"price"),sourceTimestamp:new Date(o.sourceTimestamp).toISOString(),
    receivedAt:new Date(o.receivedAt).toISOString(),
    quality:o.quality,licenseEvidence:o.licenseEvidence,rights:o.rights,
    venue:o.venue??null,quoteSide:o.quoteSide??"reference",
  });
}
export function canonicalSourceCandle(o) {
  common(o);assert(o.dataKind===DATA_KIND.CANDLE,"source OHLC kind required");
  assert(TIMEFRAMES.includes(o.timeframe),"unsupported timeframe");
  const a=ms(o.openTime,"openTime"),b=ms(o.closeTime,"closeTime");
  assert(a<b,"candle interval invalid");
  assert(typeof o.timezone==="string"&&o.timezone.length>0,"timezone required");
  const fields=Object.fromEntries(["open","high","low","close"].map(k=>[k,decimals(o[k],k)]));
  const n=(k)=>Number(fields[k]);
  assert(n("low")<=n("open")&&n("open")<=n("high")&&n("low")<=n("close")&&n("close")<=n("high"),"OHLC ordering invalid");
  return Object.freeze({
    ...fields,dataKind:o.dataKind,symbol:o.symbol,source:o.source,unit:o.unit,timeframe:o.timeframe,
    openTime:new Date(a).toISOString(),closeTime:new Date(b).toISOString(),
    volume:o.volume===undefined||o.volume===null?null:decimals(o.volume,"volume",true),
    sourceTimestamp:new Date(o.sourceTimestamp).toISOString(),receivedAt:new Date(o.receivedAt).toISOString(),
    timezone:o.timezone,quality:o.quality,licenseEvidence:o.licenseEvidence,rights:o.rights,
    venue:o.venue??null,quoteSide:o.quoteSide??"trade",
  });
}
export function mayPublish(record) {
  return record?.rights==="approved_public"&&record?.quality!=="INVALID";
}
export function transportFrame(record, sequence, publishedAt) {
  assert(Number.isSafeInteger(sequence)&&sequence>0,"sequence must be positive");
  ms(publishedAt,"publishedAt");
  assert(mayPublish(record),"unlicensed or invalid market data must not be published");
  const {licenseEvidence,rights,receivedAt,...safe}=record;
  return Object.freeze({
    type:"market.update",version:1,sequence,publishedAt:new Date(publishedAt).toISOString(),
    payload:safe,
  });
}
