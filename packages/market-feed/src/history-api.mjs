/**
 * Provider-neutral historical REST handler, designed for a licensed Neon repository.
 * No database credentials in requests/responses; no provider fetch inside HTTP handler.
 * Store adapter must use parameterized SQL, enforce permissions, and return DESC rows.
 * This handler is intentionally not mounted in the production Worker yet.
 */
const MAX=5000,DAY=86400000,allowed=new Set(["symbol","from","to","timeframe","dataKind","limit","cursor"]);
const SYMBOL=/^[A-Z0-9_]{3,48}$/;
const date=(s)=>typeof s==="string"&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const respond=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export function parseHistoryRequest(url){
  const u=url instanceof URL?url:new URL(url);
  if([...u.searchParams.keys()].some(k=>!allowed.has(k)||u.searchParams.getAll(k).length!==1))throw Error("unsupported_or_duplicated_parameter");
  const symbol=u.searchParams.get("symbol"),from=u.searchParams.get("from"),to=u.searchParams.get("to");
  const dataKind=u.searchParams.get("dataKind"),timeframe=u.searchParams.get("timeframe");
  const count=u.searchParams.get("limit")??"1000",cursor=u.searchParams.get("cursor");
  if(!SYMBOL.test(symbol??"")||!date(from)||!date(to)||from>to||
    Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z")>400*DAY||
    !["reference_point","source_ohlc"].includes(dataKind)||
    !["1d","1h"].includes(timeframe)||
    !/^[1-9]\d{0,3}$/.test(count)||Number(count)>MAX)throw Error("invalid_history_query");
  if(cursor!==null&&(typeof cursor!=="string"||cursor.length>40||!Number.isFinite(Date.parse(cursor))||!/[Zz]|[+-]\d\d:\d\d$/.test(cursor)))throw Error("invalid_cursor");
  return Object.freeze({symbol,from,to,dataKind,timeframe,limit:Number(count),cursor});
}
const safeNumber=(v)=>{
 const n=Number(v);
 if(!Number.isFinite(n)||n<=0)throw Error("invalid source price");
 return n;
};
export async function serveHistoryV2(request,{lookup}={}){
  if(request.method!=="GET")return respond({ok:false,error:"method_not_allowed"},405);
  let query;try{query=parseHistoryRequest(request.url)}catch{return respond({ok:false,error:"invalid_history_query"},400)}
  if(typeof lookup!=="function")return respond({ok:false,error:"storage_not_configured"},503);
  try{
    // lookup(query) is a repository port; it must be read-only and enforce licensing.
    const data=await lookup(query);
    if(!data||data.rights!=="approved_public"||data.dataKind!==query.dataKind||
      typeof data.unit!=="string"||!data.source||!data.attribution||!Array.isArray(data.rows))return respond({ok:false,error:"licensed_history_unavailable"},503);
    if(data.rows.length>query.limit+1)return respond({ok:false,error:"source_page_too_large"},502);
    if(data.rows.length===0)return respond({ok:false,error:"history_not_found"},404);
    const rows=data.rows.slice(0,query.limit);
    if(rows.some(r=>!["GOOD","DEGRADED","STALE"].includes(r?.quality)))throw Error("invalid provider quality");
    const output=rows.map(r=>{
      if(r.symbol!==query.symbol||r.unit!==data.unit)throw Error("repository symbol/unit mismatch");
      if(query.dataKind==="source_ohlc"&&r.timeframe!==query.timeframe)throw Error("repository timeframe mismatch");
      if(query.dataKind==="reference_point"){
        if(r.open!==undefined||r.high!==undefined||r.low!==undefined||r.close!==undefined)throw Error("point disguised as OHLC");
        const ts=Date.parse(r.sourceTimestamp);
        if(!Number.isFinite(ts))throw Error("invalid timestamp");
        const d=new Date(ts).toISOString().slice(0,10);
        if(d<query.from||d>query.to||(query.cursor&&ts>=Date.parse(query.cursor)))throw Error("out-of-window reference");
        return {time:new Date(ts).toISOString(),price:safeNumber(r.price),quality:r.quality};
      }
      const a=Date.parse(r.openTime),b=Date.parse(r.closeTime);
      if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)throw Error("invalid candle interval");
      const d=new Date(a).toISOString().slice(0,10);
      if(d<query.from||d>query.to||(query.cursor&&a>=Date.parse(query.cursor)))throw Error("out-of-window candle");
      const open=safeNumber(r.open),high=safeNumber(r.high),low=safeNumber(r.low),close=safeNumber(r.close);
      if(low>open||low>close||high<open||high<close)throw Error("invalid OHLC");
      return {time:new Date(a).toISOString(),sessionDate:typeof r.sessionDate==="string"&&date(r.sessionDate)?r.sessionDate:undefined,open,high,low,close,volume:r.volume===undefined||r.volume===null?null:Number(r.volume),quality:r.quality};
    });
    if(output.some((row,i)=>i&&row.time>=output[i-1].time))throw Error("repository rows must be strictly descending");
    if(output.some(row=>"volume" in row&&row.volume!==null&&(!Number.isFinite(row.volume)||row.volume<0)))throw Error("invalid source volume");
    const hasMore=data.rows.length>query.limit;
    const nextCursor=hasMore?output.at(-1)?.time:null;
    output.reverse();
    return respond({ok:true,symbol:query.symbol,timeframe:query.timeframe,dataKind:query.dataKind,
      source:data.source,attribution:data.attribution,unit:data.unit,
      series:output,count:output.length,page:{hasMore,nextCursor},
      delayed:data.delayed===true,qualityPolicy:"source_quality_preserved"});
  }catch{return respond({ok:false,error:"history_validation_failed"},502)}
}
