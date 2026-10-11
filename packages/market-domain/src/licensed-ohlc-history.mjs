// License-gated historical OHLC preflight. No network calls, no fabricated bars.
// Prices remain exact base-10 strings; PostgreSQL NUMERIC should receive these strings.
const DAY=86_400_000;
const UNIT_FACTORS=Object.freeze({
  "IRR_PER_USD->IRT_PER_USD":10,
  "IRR_PER_GRAM->IRT_PER_GRAM":10,
  "IRT_PER_USD->IRT_PER_USD":1,
  "IRT_PER_GRAM->IRT_PER_GRAM":1,
  "USD_PER_TROY_OUNCE->USD_PER_TROY_OUNCE":1,
  "USD_PER_BTC->USD_PER_BTC":1,
  "USD_PER_ETH->USD_PER_ETH":1,
});
const dateValid=(s)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const ms=(s,name)=>{
  if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s))throw Error(name+" must specify a timezone offset");
  const n=Date.parse(s);if(!Number.isFinite(n))throw Error(name+" is invalid");return n;
};
function decimal(value,name,factor=1){
  const str=typeof value==="number"?String(value):value;
  if(typeof str!=="string"||!/^\d{1,20}(?:\.\d{1,10})?$/.test(str))throw Error(name+" must be a positive finite decimal without exponent");
  const [a,f=""]=str.split(".");
  const scale=f.length+(factor===10?1:0);
  if(scale>10)throw Error(name+" has excessive precision after unit conversion");
  let digits=(a+f).replace(/^0+(?=\d)/,""), padded=digits.padStart(scale+1,"0");
  const text=scale?padded.slice(0,-scale)+"."+padded.slice(-scale):padded;
  const clean=text.includes(".")?text.replace(/0+$/,"").replace(/\.$/,""):text;
  const canonical=clean.replace(/^0+(?=\d)/,"");
  const n=BigInt(digits)*10n**BigInt(10-scale);
  if(n<=0n)throw Error(name+" must be positive");
  return {canonical,value:n};
}
function dateInZone(timestamp,timeZone){
  const bits=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(timestamp));
  const part=(kind)=>bits.find(x=>x.type===kind)?.value;
  return [part("year"),part("month"),part("day")].join("-");
}
function licenseGate(license,intendedUse,providerCode,receivedAt){
  if(!license||license.providerCode!==providerCode||license.status!=="approved"||
    typeof license.evidenceRef!=="string"||license.evidenceRef.length<8||
    !license.reviewedBy||!license.reviewedAt||
    license.rights?.commercialStorage!==true)throw Error("Licensed commercial storage not verified");
  if(intendedUse==="public_api"&&license.rights?.publicRedistribution!==true)throw Error("Public redistribution not authorized");
  const approvedAt=ms(license.reviewedAt,"license.reviewedAt");
  if(approvedAt>receivedAt)throw Error("Future license review");
  if(license.expiresAt&&ms(license.expiresAt,"license.expiresAt")<receivedAt)throw Error("Expired source license");
  // This checks supplied assertions, not the authenticity of a legal agreement.
}
export function preflightOhlcHistory({
  rows,providerCode,symbol,timeframe="1d",rawUnit,canonicalUnit,timeZone,
  license,intendedUse="public_api",receivedAt,from,to,isSessionDay=null
}){
  if(!["public_api","internal_storage"].includes(intendedUse))throw Error("Unsupported intendedUse");
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(providerCode||""))throw Error("Invalid providerCode");
  if(!/^[A-Z0-9_]{3,48}$/.test(symbol||""))throw Error("Invalid canonical symbol");
  if(timeframe!=="1d")throw Error("Only source-provided daily OHLC accepted");
  if(!dateValid(from)||!dateValid(to)||from>to||Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z")>800*DAY)throw Error("Invalid date window");
  if(typeof timeZone!=="string")throw Error("Missing IANA timezone");
  try{new Intl.DateTimeFormat("en-US",{timeZone})}catch{throw Error("Invalid IANA timezone")}
  const factor=UNIT_FACTORS[rawUnit+"->"+canonicalUnit];
  if(!factor)throw Error("Undocumented currency/commodity unit conversion");
  if(!Array.isArray(rows)||rows.length>3000)throw Error("Invalid batch size");
  if(isSessionDay!==null&&typeof isSessionDay!=="function")throw Error("Invalid calendar");
  const ingestedAt=ms(receivedAt,"receivedAt");
  licenseGate(license,intendedUse,providerCode,ingestedAt);
  let outOfOrder=0,duplicates=0;
  const unique=new Map();
  for(const [index,row] of rows.entries()){
    if(!row||typeof row!=="object"||Array.isArray(row))throw Error("Invalid row "+index);
    if(row.dataKind!=="source_ohlc"||row.symbol!==symbol||row.providerCode!==providerCode)throw Error("Reject reference point, derived or mismatched OHLC "+index);
    if(!dateValid(row.sessionDate)||row.sessionDate<from||row.sessionDate>to)throw Error("Invalid session date "+index);
    const openMs=ms(row.openTime,"openTime"), closeMs=ms(row.closeTime,"closeTime");
    if(openMs>=closeMs||closeMs-openMs>2*DAY||openMs>ingestedAt||closeMs>ingestedAt)throw Error("Invalid or future bar interval "+index);
    if(dateInZone(openMs,timeZone)!==row.sessionDate)throw Error("Timezone/session mismatch "+index);
    const open=decimal(row.open,"open",factor),high=decimal(row.high,"high",factor),
          low=decimal(row.low,"low",factor),close=decimal(row.close,"close",factor);
    if(low.value>open.value||low.value>close.value||high.value<open.value||high.value<close.value)throw Error("Invalid OHLC ordering "+index);
    const volume=row.volume===undefined||row.volume===null?null:decimal(row.volume,"volume",1).canonical;
    const key=symbol+"|"+timeframe+"|"+row.sessionDate;
    const entry={symbol,providerCode,timeframe:"1d",sessionDate:row.sessionDate,
      openTime:new Date(openMs).toISOString(),closeTime:new Date(closeMs).toISOString(),
      open:open.canonical,high:high.canonical,low:low.canonical,close:close.canonical,
      volume,unit:canonicalUnit,sourceUnit:rawUnit,quality:"GOOD",
      provenance:{providerCode,licenseEvidenceRef:license.evidenceRef,sourceRecordId:row.sourceRecordId??null,ingestedAt:new Date(ingestedAt).toISOString(),timeZone}};
    if(index>0&&row.sessionDate<rows[index-1].sessionDate)outOfOrder++;
    if(unique.has(key)){
      const prior=unique.get(key);
      if(["open","high","low","close","volume","openTime","closeTime"].some(k=>prior[k]!==entry[k]))throw Error("Conflicting duplicate OHLC "+key);
      duplicates++;
      continue;
    }
    unique.set(key,entry);
  }
  const candles=[...unique.values()].sort((a,b)=>a.sessionDate.localeCompare(b.sessionDate));
  let maxCalendarGapDays=0,missingExpectedSessions=0;
  for(let i=1;i<candles.length;i++){
    const a=Date.parse(candles[i-1].sessionDate+"T00:00:00Z"),b=Date.parse(candles[i].sessionDate+"T00:00:00Z");
    const delta=(b-a)/DAY;
    maxCalendarGapDays=Math.max(maxCalendarGapDays,delta);
    if(isSessionDay){
      for(let t=a+DAY;t<b;t+=DAY){if(isSessionDay(new Date(t).toISOString().slice(0,10)))missingExpectedSessions++}
    }
  }
  const coverageDays=candles.length?1+(Date.parse(candles.at(-1).sessionDate+"T00:00:00Z")-Date.parse(candles[0].sessionDate+"T00:00:00Z"))/DAY:0;
  const annualCoverageMet=coverageDays>=365;
  return {
    symbol,providerCode,timeframe,unit:canonicalUnit,dataKind:"source_ohlc",
    licenseEvidenceRef:license.evidenceRef,intendedUse,candles,
    audit:{receivedCount:rows.length,uniqueCount:candles.length,duplicates,outOfOrder,
      firstSession:candles[0]?.sessionDate??null,lastSession:candles.at(-1)?.sessionDate??null,
      coverageDays,annualCoverageMet,maxCalendarGapDays,missingExpectedSessions,
      calendarVerified:Boolean(isSessionDay),gapsFilled:0,
      readyForAnnualPublication:annualCoverageMet&&Boolean(isSessionDay)&&missingExpectedSessions===0}
  };
}
