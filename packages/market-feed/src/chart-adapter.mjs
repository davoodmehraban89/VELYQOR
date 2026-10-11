// UI data adapter: protects candlestick rendering from point-only sources.
export const REFERENCE_KIND="daily_reference_point_not_ohlc";
export function normalizeHistoryResponse(payload, expectedSymbol){
  if(!payload||payload.ok!==true||payload.symbol!==expectedSymbol)throw Error("history_not_available");
  const kind=payload.dataKind;
  if(!Array.isArray(payload.series)||payload.series.length===0)throw Error("empty_history");
  if(kind===REFERENCE_KIND||kind==="reference_point"){
    let previous="";
    const data=payload.series.map((row)=>{
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date||"")||row.date<=previous)throw Error("reference_history_order");
      const value=typeof row.close==="number"?row.close:Number(row.close);
      if(!Number.isFinite(value)||value<=0)throw Error("invalid_reference_rate");
      previous=row.date;return {time:row.date,value};
    });
    return {kind:"reference",data,source:payload.source,unit:payload.quoteCurrency??payload.unit??"unknown",storage:payload.storage??"unspecified",attribution:payload.attribution??"Source: ECB"};
  }
  if(kind!=="source_ohlc"||payload.rights!=="approved_public")throw Error("unlicensed_or_unknown_history");
  let previous=-Infinity;
  const data=payload.series.map(row=>{
    const date=row.openTime??row.time;
    const time=typeof date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:
      typeof date==="string"&&Number.isFinite(Date.parse(date))?Math.floor(Date.parse(date)/1000):date;
    const sortable=typeof time==="string"?Date.parse(time+"T00:00:00Z"):time*1000;
    if(!Number.isFinite(sortable)||sortable<=previous)throw Error("invalid_candle_time");
    const [open,high,low,close]=["open","high","low","close"].map(k=>Number(row[k]));
    if(![open,high,low,close].every(Number.isFinite)||low<=0||low>open||low>close||high<open||high<close)throw Error("invalid_candle_prices");
    previous=sortable;return {time,open,high,low,close};
  });
  return {kind:"candle",data,source:payload.source,unit:payload.unit,storage:payload.storage??"unspecified",attribution:payload.attribution??"Source attribution required"};
}
export function normalizeStreamUpdate(event,symbol,kind){
  if(event?.version!==1||event.type!=="market.update"||event.payload?.symbol!==symbol)return null;
  const row=event.payload;
  if(kind==="reference"&&row.dataKind==="reference_point"){
    const timestamp=Date.parse(row.sourceTimestamp);
    const value=Number(row.price);
    if(!Number.isFinite(timestamp)||!Number.isFinite(value)||value<=0)return null;
    return {time:new Date(timestamp).toISOString().slice(0,10),value};
  }
  if(kind==="candle"&&row.dataKind==="source_ohlc"){
    const n=["open","high","low","close"].map(k=>Number(row[k]));
    if(!n.every(Number.isFinite)||n[2]<=0||n[2]>n[0]||n[2]>n[3]||n[1]<n[0]||n[1]<n[3])return null;
    const time=row.timeframe==="1d"?new Date(row.openTime).toISOString().slice(0,10):Math.floor(Date.parse(row.openTime)/1000);
    if(typeof time==="number"&&!Number.isFinite(time))return null;
    return {time,open:n[0],high:n[1],low:n[2],close:n[3]};
  }
  return null;
}
