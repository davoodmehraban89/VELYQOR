/**
 * Narrow, read-only ECB repository for /api/v2/history.
 * Secret is server-side only; the existing PostgreSQL view enforces the scope.
 * No OHLC reads and no DDL/INSERT/UPDATE/DELETE operations.
 */
const UNITS=Object.freeze({EUR_USD_ECB:"USD_PER_EUR",EUR_GBP_ECB:"GBP_PER_EUR",EUR_CHF_ECB:"CHF_PER_EUR"});
const QUOTES=Object.freeze({EUR_USD_ECB:"USD",EUR_GBP_ECB:"GBP",EUR_CHF_ECB:"CHF"});
const SERIES=Object.freeze({EUR_USD_ECB:"EXR.D.USD.EUR.SP00.A",EUR_GBP_ECB:"EXR.D.GBP.EUR.SP00.A",EUR_CHF_ECB:"EXR.D.CHF.EUR.SP00.A"});
const PROVIDER_KIND="daily_reference_point_not_ohlc";
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function buildNeonEcbHistoryLookup({databaseUrl,fetchImpl=fetch}={}){
 if(typeof databaseUrl!=="string"||!databaseUrl)throw Error("history_reader_not_configured");
 let uri;
 try{uri=new URL(databaseUrl)}catch{throw Error("history_reader_not_configured")}
 if(!["postgres:","postgresql:"].includes(uri.protocol)||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/i.test(uri.hostname)||
    !uri.username||!uri.password||uri.pathname!=="/neondb")throw Error("history_reader_not_configured");
 if(decodeURIComponent(uri.username)!=="chartnova_history_ro")throw Error("restricted_history_reader_required");
 if(typeof fetchImpl!=="function")throw Error("invalid_transport");
 const endpoint="https://"+uri.hostname+"/sql";
 return async function lookup(query){
  if(!query||query.dataKind!=="reference_point"||query.timeframe!=="1d"||
     !has(UNITS,query.symbol)||!Number.isSafeInteger(query.limit)||query.limit<1||query.limit>5000)return null;
  const from=Date.parse(query.from+"T00:00:00Z"),to=Date.parse(query.to+"T00:00:00Z");
  if(!Number.isFinite(from)||!Number.isFinite(to)||from>to||to-from>400*86400000)throw Error("invalid_window");
  const limit=query.limit+1;
  const sql=[
   "SELECT symbol,quote_asset,source,observation_at,price,quality,flags",
   "FROM public.chartnova_history_public",
   "WHERE symbol=$1",
   " AND observation_at >= $2::timestamptz",
   " AND observation_at < $3::timestamptz",
   " AND ($4::timestamptz IS NULL OR observation_at < $4::timestamptz)",
   "ORDER BY observation_at DESC",
   "LIMIT $5::integer"
  ].join("\n");
  const params=[query.symbol,new Date(from).toISOString(),new Date(to+86400000).toISOString(),query.cursor??null,limit];
  const response=await fetchImpl(endpoint,{
   method:"POST",headers:{
    "content-type":"application/json",
    "Neon-Connection-String":databaseUrl,
    "Neon-Raw-Text-Output":"true",
    "Neon-Array-Mode":"false",
   },
   body:JSON.stringify({query:sql,params}),
   signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw Error("history_storage_unavailable");
  const json=await response.json();
  if(!Array.isArray(json?.rows)||json.rows.length>limit)throw Error("history_storage_invalid_response");
  const rows=json.rows.map(row=>{
   const when=Date.parse(row?.observation_at??"");
   if(!Number.isFinite(when))throw Error("history_storage_provenance_rejected");
   const day=new Date(when).toISOString().slice(0,10);
   const price=String(row.price??"");
   if(row.symbol!==query.symbol||row.quote_asset!==QUOTES[query.symbol]||
     row.source!=="ecb_exr"||
     !/^(?:0|[1-9]\d{0,19})(?:\.\d{1,16})?$/.test(price)||
     !(Number(price)>0)||!["GOOD","DEGRADED","STALE"].includes(row.quality)||
     row.flags?.data_kind!==PROVIDER_KIND||row.flags?.observation_date!==day||
     row.flags?.source_series!==SERIES[query.symbol]||
     row.flags?.license!=="ECB/ESCB open statistics; attribution required"){
     throw Error("history_storage_provenance_rejected");
   }
   return {symbol:query.symbol,unit:UNITS[query.symbol],
    sourceTimestamp:new Date(when).toISOString(),price,quality:row.quality};
  });
  if(rows.some((r,i)=>i>0&&r.sourceTimestamp>=rows[i-1].sourceTimestamp))throw Error("history_storage_out_of_order");
  return {rights:"approved_public",source:"ECB",dataKind:"reference_point",
   attribution:"Source: European Central Bank (ECB), EXR daily euro foreign exchange reference rates",
   unit:UNITS[query.symbol],rows,delayed:true};
 };
}
