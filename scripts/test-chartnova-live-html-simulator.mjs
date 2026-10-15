/**
 * Integration test of the actual DEPLOYED v26 HTML in an ephemeral browser.
 *
 * Does not upload or deploy a Cloudflare Worker and does not modify the
 * live site. Only the test browser is served simulated HTML+summary JSON.
 */
import { chromium, webkit } from 'playwright';
import {patchChartNovaV26} from './patch-chartnova-v26-light-catalog.mjs';
import {marketCatalogSummary} from '../packages/market-domain/src/market-catalog-summary.mjs';

const ORIGIN='https://chartnova.ir/';
const read=async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('public preflight '+response.status+' '+url);
 return response;
};
const [htmlResponse,catalogResponse]=await Promise.all([
 read(ORIGIN),read(ORIGIN+'api/markets')
]);
const html=await htmlResponse.text();
const catalog=await catalogResponse.json();
const projected=marketCatalogSummary(catalog);
if(!projected.ok||projected.markets.length<40)
 throw Error('Missing verified live market catalog');
const originalSize=JSON.stringify(catalog).length,summarySize=JSON.stringify(projected).length;
if(summarySize/originalSize>=0.35)
 throw Error('Snapshot was not sufficiently smaller than full catalog');

const syntheticV26=
 'export default {async fetch(request,env){const url=new URL(request.url);'+
 'const preserveOriginalBackend='+JSON.stringify('x'.repeat(41000))+';'+
 'if(url.pathname==="/api/markets"&&request.method==="GET"){return Response.json({ok:true})}'+
 'return new Response('+JSON.stringify(html)+
 ',{headers:{"content-type":"text/html; charset=utf-8"}})'+
 '},async scheduled(event,env){}}';
const patched=patchChartNovaV26(syntheticV26);
for(const spec of [{browserName:'Chromium',engine:chromium},{browserName:'WebKit',engine:webkit}]){
const errors=[],summaryCalls=[],marketCalls=[];
const browser=await spec.engine.launch({headless:true});
const stats={browser:spec.browserName,model:'staged-v26-html-in-browser',originalBytes:originalSize,summaryBytes:summarySize,
 savingsPercent:Math.round((1-summarySize/originalSize)*100),catalogCount:projected.markets.length};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
   hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e.message).slice(0,300)));
 await page.route(ORIGIN,route=>route.fulfill({
   status:200,contentType:'text/html; charset=utf-8',body:patched.newHTML
 }));
 await page.route('**/api/markets/summary',route=>{
   summaryCalls.push(route.request().url());
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(projected)});
 });
 await page.route('**/api/markets?symbol=*',async route=>{
   marketCalls.push(route.request().url());
   await new Promise(done=>setTimeout(done,600));
   await route.continue();
 });
 const response=await page.goto(ORIGIN,{waitUntil:'domcontentloaded',timeout:18000});
 stats.status=response?.status();
 await page.waitForFunction(()=>{
   const usd=document.getElementById('usd')?.textContent||'';
   const gold=document.getElementById('gold18')?.textContent||'';
   return usd.includes('تومان') && gold.includes('تومان');
 },undefined,{timeout:15000});
 await page.waitForFunction(()=>document.getElementById('chartbox')?.querySelector('svg'),undefined,{timeout:18000});
 stats.dashboard=await page.evaluate(()=>({
   usd:document.getElementById('usd')?.textContent,
   gold:document.getElementById('gold18')?.textContent,
   chart:!!document.getElementById('chartbox')?.querySelector('svg'),
   marketStatus:document.getElementById('status')?.textContent
 }));
 await page.locator('[data-nav="markets"]').first().click();
 stats.visibleMarkets=await page.locator('#marketgrid .marketitem').count();
 const eur=page.locator('#marketgrid .marketitem').filter({has:page.locator('code.ticker',{hasText:'EUR-IRT'})});
 if(await eur.count()){
   await eur.locator('button.pill').click();
   await page.waitForFunction(()=>{
     const title=document.getElementById('techTitle')?.textContent||'';
     const status=document.getElementById('techStatus')?.textContent||'';
     return title.includes('EUR-IRT')&&status.includes('نمونه ساعتی');
   },undefined,{timeout:16000});
   stats.technical=await page.locator('#techStatus').textContent();
 }else{
   throw Error('EUR-IRT not present in live verified catalog');
 }
 stats.summaryCalls=summaryCalls.length;
 stats.historyRequests=marketCalls.map(url=>new URL(url).searchParams.get('symbol'));
 stats.jsErrors=errors;
 await context.close();
}finally{await browser.close()}
console.log('CHARTNOVA_SIMULATED_V26_LAZY_MARKET '+JSON.stringify(stats));
if(stats.status!==200||!stats.dashboard?.chart||stats.visibleMarkets!==projected.markets.length||
 stats.summaryCalls!==1||stats.historyRequests.length<2||
 stats.historyRequests.some(symbol=>!symbol)||errors.length)
 throw Error('Browser integration did not meet acceptance criteria');
}
