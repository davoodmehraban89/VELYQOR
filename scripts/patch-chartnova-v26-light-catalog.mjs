import {marketCatalogSummary} from '../packages/market-domain/src/market-catalog-summary.mjs';

/**
 * Fail-closed integration into the original Cloudflare ChartNova Worker v26.
 * INPUT: clean module JS of the ACTIVE v26 version; never last-uploaded v27.
 * Does not itself access Cloudflare APIs, publish versions, or deploy.
 */
function replaceOnce(text,oldPart,newPart,label){
 const count=text.split(oldPart).length-1;
 if(count!==1)throw new Error(label+': expected one anchor, found '+count);
 return text.replace(oldPart,newPart);
}
const routeAnchor='if(url.pathname==="/api/markets"&&request.method==="GET"){';
const summaryRoute=[
 'if(url.pathname==="/api/markets/summary"&&request.method==="GET"){',
 ' const catalog=await stored(env,"markets:gheymat:v1");',
 ' const result=marketCatalogSummary(catalog,Date.now());',
 ' return Response.json(result,{status:result.ok?200:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});',
 '}',
 ''
].join('\n');

const oldMarketRendering=' renderMarkets();renderTechnical();renderSelected();';
const lazyMarketRendering=[
 ' if(!el("markets").hidden)renderMarkets();',
 ' if(!el("technical").hidden)renderTechnical();',
 ' if(!el("dashboard").hidden)renderSelected();',
 ' if(!el("widget").hidden)renderWidget();'
].join('\n');
const oldRefreshRendering=' renderSelected();renderMarkets();renderTechnical();';
const lazyRefreshRendering=[
 ' if(!el("dashboard").hidden)renderSelected();',
 ' if(!el("markets").hidden)renderMarkets();',
 ' if(!el("technical").hidden)renderTechnical();',
 ' if(!el("widget").hidden)renderWidget();'
].join('\n');
const chartnovaSeriesHelper="\nconst chartnovaSeriesCache=new Map();\nconst chartnovaSeriesInFlight=new Map();\nconst chartnovaSeriesRetryAfter=new Map();\nasync function requestChartnovaSeries(symbol){\n const active=instrument(symbol);\n if(!active||active.historyCount<2||Array.isArray(active.history)||\n    chartnovaSeriesInFlight.has(symbol)||\n    Date.now()<(chartnovaSeriesRetryAfter.get(symbol)||0))return;\n if(!/^[A-Z0-9]{1,20}-[A-Z0-9]{2,10}$/.test(symbol))return;\n const job=(async()=>{\n  const response=await fetch(\"/api/markets?symbol=\"+encodeURIComponent(symbol),{cache:\"no-store\"});\n  if(!response.ok)throw Error(\"series_fetch_status\");\n  const payload=await response.json(),row=payload.markets?.[0];\n  if(payload.ok!==true||payload.source!==marketState.source||\n     !Array.isArray(payload.markets)||payload.markets.length!==1||\n     row?.symbol!==symbol||payload.fetchedAt!==marketState.receivedAt||\n     row?.updatedAt!==active.updatedAt||row?.sellPrice!==active.sellPrice)\n   throw Error(\"series_snapshot_mismatch\");\n  const points=row.history;\n  if(!Array.isArray(points)||points.length!==active.historyCount||\n     points.length>168||!points.every(v=>Number.isFinite(v)&&v>0))\n   throw Error(\"series_quality_gate\");\n  if(instrument(symbol)!==active)return;\n  active.history=points.slice();\n  chartnovaSeriesCache.set(symbol,{updatedAt:active.updatedAt,history:points.slice()});\n  if(chartnovaSeriesCache.size>12)chartnovaSeriesCache.delete(chartnovaSeriesCache.keys().next().value);\n  if(!el(\"technical\").hidden&&marketState.selected===symbol)renderTechnical();\n  const asset=chosen===\"usd\"?\"USD-IRT\":chosen===\"gold18\"?\"GOLD18-IRT\":\"GOLDO-USD\";\n  if(!el(\"dashboard\").hidden&&asset===symbol)renderSelected();\n })().catch(()=>{chartnovaSeriesRetryAfter.set(symbol,Date.now()+30000)}).\n finally(()=>{chartnovaSeriesInFlight.delete(symbol)});\n chartnovaSeriesInFlight.set(symbol,job);\n await job;\n}\n";
const preloadCachedSeries="marketState.items=payload.markets;\n for(const m of marketState.items){\n  const cached=chartnovaSeriesCache.get(m.symbol);\n  if(cached&&cached.updatedAt===m.updatedAt&&\n    cached.history.length===m.historyCount)m.history=cached.history.slice();\n }";
export function patchChartNovaV26(source){
 if(typeof source!=='string'||!source.startsWith('export default {')||source.length<40000)
  throw new Error('Expected clean v26 Worker source, not Cloudflare multipart wrapper');
 if(source.includes('chartnovaRefreshInFlight')||source.includes('/api/markets/summary'))
  throw new Error('Version mismatch: refuses uploaded v27 or already-patched script');
 if(!source.includes('async scheduled(event,env)'))throw new Error('Scheduled handler absent');
 const before=source;
 source=replaceOnce(source,routeAnchor,summaryRoute+routeAnchor,'new read-only route');
 source+='\n'+marketCatalogSummary.toString()+'\n';
 const start=source.indexOf('return new Response("<!doctype html>');
 const end=source.indexOf('",{headers:{"content-type":"text/html; charset=utf-8"',start);
 if(start<0||end<0)throw new Error('Original HTML response not found');
 const litStart=start+'return new Response('.length;
 let html;
 try{html=JSON.parse(source.slice(litStart,end+1))}catch{throw new Error('HTML literal decode failed')}
 const first=html.indexOf('<script>'),last=html.indexOf('</script>',first);
 if(first<0||last<0||html.indexOf('<script>',first+1)!==-1)
  throw new Error('Expected one original inline UI script');
 const oldJS=html.slice(first+8,last);
 let js=oldJS;
 js=replaceOnce(js,'function renderSelected(){',chartnovaSeriesHelper+'\nfunction renderSelected(){','history fetch helper');
 js=replaceOnce(js,'const response=await fetch("/api/markets",{cache:"no-store"});','const response=await fetch("/api/markets/summary",{cache:"no-store"});','small snapshot fetch');
 js=replaceOnce(js,'marketState.items=payload.markets;',preloadCachedSeries,'cached series retention');
 js=replaceOnce(js,oldMarketRendering,lazyMarketRendering,'lazy loaded markets');
 js=replaceOnce(js,oldRefreshRendering,lazyRefreshRendering,'lazy refresh');
 js=replaceOnce(js,'if(m?.history?.length>1){',
  'if(m?.historyCount>1&&!Array.isArray(m.history))void requestChartnovaSeries(code);\n if(m?.history?.length>1){',
  'on-demand dashboard history');
 js=replaceOnce(js,' const history=m.history||[];',
  ' if(m.historyCount>1&&!Array.isArray(m.history))void requestChartnovaSeries(m.symbol);\n const history=m.history||[];',
  'on-demand technical history');
 js=replaceOnce(js,'m.history?.length+" نمونه ساعتی"',
  '(m.historyCount??m.history?.length??0)+" نمونه ساعتی"','show true available count');
 const updatedHTML=html.slice(0,first+8)+js+html.slice(last);
 if(updatedHTML.replace(js,oldJS)!==html)throw new Error('HTML unexpectedly modified');
 source=source.slice(0,litStart)+JSON.stringify(updatedHTML)+source.slice(end+1);
 if(!source.includes('async scheduled(event,env)')||source.length<before.length)
  throw new Error('Output truncated or lost backend handlers');
 return {source,originalBytes:before.length,oldHTML:html,newHTML:updatedHTML,oldJS,newJS:js};
}
