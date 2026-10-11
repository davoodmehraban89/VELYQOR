import fs from 'node:fs/promises';
import path from 'node:path';

// Official ECB daily REFERENCE rates, NOT OHLC candles.
// Free commercial reuse with source attribution: https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html
const ROOT = path.resolve(import.meta.dirname,'..');
const FROM = '2025-10-11', TO = '2026-10-11';
const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+CHF.EUR.SP00.A?startPeriod='+FROM+'&endPeriod='+TO+'&format=csvdata';
const MAP = { USD:'EUR_USD_ECB', GBP:'EUR_GBP_ECB', CHF:'EUR_CHF_ECB' };
const dryRun = !process.argv.includes('--commit');

function csvRows(text){
  let rows=[],row=[],item='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted && text[i+1]==='"'){item+='"';i++;}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(item);item='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(item);item='';
      if(row.some(x=>x.trim()))rows.push(row);
      row=[];
    }else item+=ch;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(item||row.length){row.push(item);rows.push(row);}
  const header=rows.shift();
  if(!header||!header.includes('TIME_PERIOD')||!header.includes('OBS_VALUE'))throw Error('ECB schema mismatch');
  return rows.map(row=>Object.fromEntries(header.map((k,i)=>[k,row[i]??''])));
}
function normalize(csv){
  const parsed=csvRows(csv);
  const bySymbol=new Map(),report={total:parsed.length,accepted:0,duplicates:0};
  for(const record of parsed){
    if(record.FREQ!=='D'||record.CURRENCY_DENOM!=='EUR'||!Object.hasOwn(MAP,record.CURRENCY)||record.EXR_TYPE!=='SP00'||record.EXR_SUFFIX!=='A')
      throw Error('Unexpected ECB series');
    if(record.OBS_STATUS!=='A')throw Error('Unconfirmed ECB observation '+record.TIME_PERIOD);
    const day=record.TIME_PERIOD;
    if(!/^\d{4}-\d\d-\d\d$/.test(day)||day<FROM||day>TO||!Number.isFinite(Date.parse(day+'T00:00:00.000Z')))throw Error('Invalid trade date '+day);
    const price=Number(record.OBS_VALUE);
    if(!Number.isFinite(price)||price<=0||price>100)throw Error('Invalid ECB rate '+day);
    const symbol=MAP[record.CURRENCY],key=symbol+'|'+day;
    const original=bySymbol.get(key);
    if(original){if(original.price!==String(price))throw Error('Conflicting duplicate '+key);report.duplicates++;continue;}
    bySymbol.set(key,{
      symbol,
      // Point timestamp is end-of-day UTC, avoiding intraday look-ahead from publication-time ambiguity.
      ts:day+'T23:59:59.000Z',
      price:String(price),
      flags:{
        data_kind:'daily_reference_point_not_ohlc',
        source:'ECB EXR',
        source_series:record.KEY,
        observation_date:day,
        release_time:'unknown',
        publish_time_policy:'end_of_day_utc_conservative',
        unit:record.UNIT,
        license:'ECB/ESCB open statistics; attribution required'
      }
    });
    report.accepted++;
  }
  const list=[...bySymbol.values()].sort((a,b)=>a.ts.localeCompare(b.ts)||a.symbol.localeCompare(b.symbol));
  for(const key of Object.values(MAP)){
    const sub=list.filter(x=>x.symbol===key);
    if(sub.length<200||sub.length>270)throw Error('Unexpected yearly coverage for '+key+': '+sub.length);
    report[key]={count:sub.length,first:sub[0].ts.slice(0,10),last:sub.at(-1).ts.slice(0,10)};
  }
  return {list,report};
}
async function databaseURL(){
  const text=await fs.readFile(path.join(ROOT,'.env.local'),'utf8');
  const line=text.split(/\r?\n/).find(x=>x.startsWith('DATABASE_URL='));
  if(!line)throw Error('Missing DATABASE_URL');
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g,'');
}
async function execute(dbURL,query,params){
  const u=new URL(dbURL);
  const r=await fetch('https://'+u.hostname+'/sql',{
    method:'POST',headers:{'content-type':'application/json','Neon-Connection-String':dbURL,'Neon-Raw-Text-Output':'true','Neon-Array-Mode':'false'},
    body:JSON.stringify({query,params}),signal:AbortSignal.timeout(20000)
  });
  const t=await r.text();
  if(!r.ok)throw Error('Neon HTTP '+r.status+': '+t.slice(0,450));
  return JSON.parse(t);
}
const INSERT = `
INSERT INTO market_ticks(instrument_id,provider_id,ts,price,quality,quality_score,flags)
SELECT i.id,p.id,x.ts,x.price,'GOOD'::quality_state,95::numeric,x.flags
FROM jsonb_to_recordset($1::jsonb) AS x(symbol text,ts timestamptz,price numeric,flags jsonb)
JOIN instruments i ON i.symbol=x.symbol
JOIN providers p ON p.code='ecb_exr'
ON CONFLICT (instrument_id,provider_id,ts) DO NOTHING
`;
async function main(){
  let r, lastError;
  for(let attempt=1;attempt<=4;attempt++){
    try{r=await fetch(ECB_URL,{headers:{Accept:'text/csv','User-Agent':'ChartNova/1.0 (+https://chartnova.ir)'},signal:AbortSignal.timeout(22000)});if(r.ok)break;lastError=new Error('ECB HTTP '+r.status)}
    catch(e){lastError=e}
    if(attempt<4)await new Promise(resolve=>setTimeout(resolve,attempt*900));
  }
  if(!r||!r.ok)throw lastError || Error('ECB not reachable');
  if(!r.ok)throw Error('ECB HTTP '+r.status);
  const data=normalize(await r.text());
  const report={provider:'ECB',source:ECB_URL,window:[FROM,TO],dryRun,...data.report};
  const reportFile=path.join(ROOT,'artifacts','ecb-history-import-report.json');
  await fs.mkdir(path.dirname(reportFile),{recursive:true});
  if(!dryRun){
    const db=await databaseURL();
    let inserted=0;
    for(let i=0;i<data.list.length;i+=100){
      const batch=data.list.slice(i,i+100);
      const result=await execute(db,INSERT,[JSON.stringify(batch)]);
      inserted+=Number(result.rowCount||0);
    }
    report.insertedThisRun=inserted;
    const verify=await execute(db,`SELECT i.symbol,COUNT(*)::int AS count, MIN(t.ts)::text AS first_date, MAX(t.ts)::text AS last_date FROM market_ticks t JOIN instruments i ON i.id=t.instrument_id JOIN providers p ON p.id=t.provider_id WHERE p.code='ecb_exr' GROUP BY i.symbol ORDER BY i.symbol`,[]);
    report.database=verify.rows;
    for(const [symbol,expected] of Object.entries(data.report).filter(([name])=>name.startsWith('EUR_'))){
      const got=verify.rows.find(x=>x.symbol===symbol);
      if(!got||Number(got.count)!==expected.count)throw Error('Neon verification mismatch '+symbol);
    }
  }
  await fs.writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error('FAILED',e.message);process.exitCode=1});
