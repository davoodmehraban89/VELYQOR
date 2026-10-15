import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { patchChartNovaV26 } from './patch-chartnova-v26-light-catalog.mjs';

const jsx=[
 'const marketState={items:[],source:null,receivedAt:null,selected:"USD-IRT"};',
 'const data={};let chosen="usd";',
 'function instrument(symbol){return marketState.items.find(x=>x.symbol===symbol)}',
 'function el(id){return document.getElementById(id)}',
 'function renderMarkets(){const m={history:[]};void(m.history?.length+" نمونه ساعتی")}',
 'function renderTechnical(){const m=instrument(marketState.selected);if(!m)return; const history=m.history||[];void history;}',
 'function renderSelected(){const code="USD-IRT",m=instrument(code);if(m?.history?.length>1){void m.history}}',
 'function renderWidget(){}',
 'async function loadMarkets(){',
 ' const response=await fetch("/api/markets",{cache:"no-store"});',
 ' const payload=await response.json();',
 ' marketState.items=payload.markets;',
 ' renderMarkets();renderTechnical();renderSelected();',
 '}',
 'async function refresh(){',
 ' await Promise.allSettled([loadMarkets()]);',
 ' renderSelected();renderMarkets();renderTechnical();',
 '}'
].join('\n');
function v26(js=jsx){
 const html='<!doctype html><html lang="fa"><body><div id="app"></div><script>'+js+'</script></body></html>';
 return 'export default {async fetch(request,env){const url=new URL(request.url);'
  +'const noChange='+JSON.stringify('x'.repeat(41000))+';'
  +'if(url.pathname==="/api/markets"&&request.method==="GET"){return Response.json({ok:true})}'
  +'return new Response('+JSON.stringify(html)+',{headers:{"content-type":"text/html; charset=utf-8"}})'
  +'},async scheduled(event,env){}}'
  +'\nasync function stored(env,key){return env.MARKET_CACHE.get(key,"json")}';
}
const snapshot=()=>({
 ok:true,source:'gheymat.online',fetchedAt:'2026-10-15T10:59:00Z',
 markets:[{
   symbol:'USD-IRT',name:'دلار',base:'USD',quote:'IRT',category:'CURRENCY',
   sellPrice:100000,buyPrice:100100,change:2,updatedAt:'2026-10-15T10:59:00Z',
   isUpToDate:true,history:Array.from({length:168},(_,i)=>90000+i)
 }]
});
test('patches only known anchors and retains old route, while loading history on demand',()=>{
 const input=v26(),r=patchChartNovaV26(input);
 assert.ok(r.source.length>input.length);
 assert.ok(r.newJS.includes('"/api/markets/summary"'));
 assert.ok(r.newJS.includes('requestChartnovaSeries'));
 assert.ok(r.newJS.includes('chartnovaSeriesCache'));
 assert.equal(r.newHTML.replace(r.newJS,r.oldJS),r.oldHTML);
 assert.ok(r.source.includes('async scheduled(event,env)'));
 assert.ok(r.source.includes('if(url.pathname==="/api/markets"&&request.method==="GET"){'));
 assert.doesNotThrow(()=>new Script(r.newJS));
 assert.ok(!r.newJS.includes('renderSelected();renderMarkets();renderTechnical();'));
});
test('updated Worker serves lightweight JSON from unchanged source catalog',async()=>{
 const transformed=patchChartNovaV26(v26());
 const uri='data:text/javascript;base64,'+Buffer.from(transformed.source).toString('base64');
 const mod=await import(uri),cache=snapshot(),before=JSON.stringify(cache);
 const result=await mod.default.fetch(new Request('https://chartnova.ir/api/markets/summary'),{
   MARKET_CACHE:{get:async key=>key==='markets:gheymat:v1'?cache:null}
 });
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.ok,true);
 assert.equal(data.markets[0].symbol,'USD-IRT');
 assert.equal(data.markets[0].history,undefined);
 assert.equal(data.markets[0].historyCount,168);
 assert.equal(JSON.stringify(cache),before);
 assert.equal(result.headers.get('cache-control'),'no-store');
});
test('refuses missing catalog instead of inventing prices',async()=>{
 const transformed=patchChartNovaV26(v26());
 const mod=await import('data:text/javascript;base64,'+Buffer.from(transformed.source).toString('base64'));
 const result=await mod.default.fetch(new Request('https://chartnova.ir/api/markets/summary'),{
   MARKET_CACHE:{get:async()=>null}
 });
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,'market_data_not_collected');
});
test('rejects Cloudflare multipart and most-recent uploaded v27 instead of active v26',()=>{
 assert.throws(()=>patchChartNovaV26('--boundary\r\n'+v26()),/clean v26/);
 assert.throws(()=>patchChartNovaV26(v26().replace('const noChange=', 'const chartnovaRefreshInFlight=null;const noChange=')),/Version mismatch/);
});
test('fails closed against unknown original HTML/JS and repeated application',()=>{
 assert.throws(()=>patchChartNovaV26(v26(jsx.replace('fetch("/api/markets"', 'fetch("/api/not-markets"'))),/small snapshot fetch/);
 assert.throws(()=>patchChartNovaV26(v26(jsx.replace('renderMarkets();renderTechnical();renderSelected();','renderMarkets();'))),/lazy loaded markets/);
 assert.throws(()=>patchChartNovaV26(patchChartNovaV26(v26()).source),/Version mismatch/);
});
