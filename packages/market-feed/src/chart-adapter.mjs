// Client view adapter: never synthesize OHLC from price/reference observations.
// Supports both legacy ECB /api/history and licensed provider-neutral /api/v2/history.
export const REFERENCE_KIND="daily_reference_point_not_ohlc";
const validDay=(value)=>typeof value==="string"&&/^\d{4}-\d\d-\d\d$/.test(value)&&
  Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
const timeToMillis=(value)=>{
 if(validDay(value))return Date.parse(value+"T00:00:00Z");
 if(typeof value==="string"&&Number.isFinite(Date.parse(value))&&/T/.test(value)&&/(Z|[+-]\d\d:\d\d)$/.test(value))return Date.parse(value);
 return NaN;
};
function positiveNumber(x,name){
 const n=Number(x);if(!Number.isFinite(n)||n<=0)throw Error("invalid_"+name);return n;
}
function normalizeReference(payload,legacy){
 let previous=-Infinity;
 const timeframe=payload.timeframe??"1d";
 const data=payload.series.map((row)=>{
  const stamp=legacy?row.date:row.time;
  const at=timeToMillis(stamp);
  if(!Number.isFinite(at)||at<=previous)throw Error("reference_history_order");
  const value=positiveNumber(legacy?row.close:row.price,"reference_rate");
  previous=at;
  return {time:timeframe==="1h"?Math.floor(at/1000):new Date(at).toISOString().slice(0,10),value};
 });
 return {kind:"reference",timeframe,data,source:payload.source,unit:payload.quoteCurrency??payload.unit??"unknown",
  storage:payload.storage??"unspecified",attribution:payload.attribution??"Source attribution required"};
}
function normalizeCandles(payload){
 if(payload.rights!=="approved_public")throw Error("unlicensed_or_unknown_history");
 const timeframe=payload.timeframe??"1d";
 let previous=-Infinity;
 const data=payload.series.map(row=>{
  const stamp=row.openTime??row.time;
  const at=timeToMillis(stamp);
  if(!Number.isFinite(at))throw Error("invalid_candle_time");
  const session=validDay(row.sessionDate)?row.sessionDate:null;
  const time=timeframe==="1d"?(session??new Date(at).toISOString().slice(0,10)):Math.floor(at/1000);
  const comparable=typeof time==="string"?Date.parse(time+"T00:00:00Z"):time*1000;
  if(!Number.isFinite(comparable)||comparable<=previous)throw Error("invalid_candle_time");
  const [open,high,low,close]=["open","high","low","close"].map(k=>positiveNumber(row[k],k));
  if(low>open||low>close||high<open||high<close)throw Error("invalid_candle_prices");
  previous=comparable;
  return {time,open,high,low,close};
 });
 return {kind:"candle",timeframe,data,source:payload.source,unit:payload.unit,
  storage:payload.storage??"unspecified",attribution:payload.attribution??"Source attribution required"};
}
export function normalizeHistoryResponse(payload,expectedSymbol){
 if(!payload||payload.ok!==true||payload.symbol!==expectedSymbol)throw Error("history_not_available");
 if(!Array.isArray(payload.series)||payload.series.length===0)throw Error("empty_history");
 if(payload.dataKind===REFERENCE_KIND||payload.dataKind==="reference_point")
  return normalizeReference(payload,payload.dataKind===REFERENCE_KIND);
 if(payload.dataKind!=="source_ohlc")throw Error("unlicensed_or_unknown_history");
 return normalizeCandles(payload);
}
export function normalizeStreamUpdate(event,symbol,kind,timeframe="1d"){
 if(event?.version!==1||event.type!=="market.update"||event.payload?.symbol!==symbol)return null;
 const row=event.payload;
 if(kind==="reference"&&row.dataKind==="reference_point"){
  const at=timeToMillis(row.sourceTimestamp),value=Number(row.price);
  if(!Number.isFinite(at)||!Number.isFinite(value)||value<=0)return null;
  return {time:timeframe==="1h"?Math.floor(at/1000):new Date(at).toISOString().slice(0,10),value};
 }
 if(kind==="candle"&&row.dataKind==="source_ohlc"){
  const at=timeToMillis(row.openTime);
  if(!Number.isFinite(at))return null;
  const n=["open","high","low","close"].map(k=>Number(row[k]));
  if(!n.every(Number.isFinite)||n[2]<=0||n[2]>n[0]||n[2]>n[3]||n[1]<n[0]||n[1]<n[3])return null;
  const time=timeframe==="1d"?(validDay(row.sessionDate)?row.sessionDate:new Date(at).toISOString().slice(0,10)):Math.floor(at/1000);
  return {time,open:n[0],high:n[1],low:n[2],close:n[3]};
 }
 return null;
}
