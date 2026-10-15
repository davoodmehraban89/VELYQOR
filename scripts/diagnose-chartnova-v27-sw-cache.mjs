/**
 * Isolated v27 ORIGINAL Service Worker offline cache behavior.
 * Real / and /sw.js are obtained via read-only GET; all REST API calls mocked.
 * Poisoning cache is restricted to a throwaway Playwright browser profile and
 * demonstrates a possible failure mechanism, not the user's actual root cause.
 */
import {chromium} from 'playwright';
const host='https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/';
const check=async path=>{
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(host+path,{signal:AbortSignal.timeout(18000)});if(r.ok)return r.text();}
  catch(e){if(attempt===2)throw Error('staged_SW_network_unavailable_after_3_attempts');}
  if(attempt<2)await new Promise(done=>setTimeout(done,1000*(attempt+1)));
 }
 throw Error('staged_SW_HTTP_unavailable_after_retries');
};
const [html,sw]=await Promise.all([check(''),check('sw.js')]);
if(!sw.includes("caches.match('/')")||!sw.includes("chartnova-v1"))
 throw Error('Actual versioned SW script differs from expected cached navigation strategy');
const browser=await chromium.launch({headless:true});
const report={scenario:'actual_v27_service_worker_offline_and_artificial_poison',versionUrl:host,actualSWBytes:sw.length};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,serviceWorkers:'allow'});
 await ctx.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"STAGING_ONLY"}'}));
 await ctx.route(host,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await ctx.route('**/sw.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:sw}));
 // Cache installation assets; no request to production and no provider/DB mutation.
 await ctx.route('**/icon.svg',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'}));
 await ctx.route('**/manifest.webmanifest',r=>r.fulfill({status:200,contentType:'application/manifest+json',body:'{"name":"ChartNova Preview","start_url":"/"}'}));
 const page=await ctx.newPage();
 const exceptions=[];
 page.on('pageerror',e=>exceptions.push(String(e.message).slice(0,200)));
 await page.goto(host,{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,undefined,{timeout:12000});
 await page.waitForFunction(async()=> (await caches.keys()).includes('chartnova-v1'),undefined,{timeout:12000});
 await ctx.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded',timeout:16000});
 report.validCachedOfflineVisible=await page.evaluate(()=>!!document.querySelector('.shell')&&
   document.querySelector('.shell').getBoundingClientRect().width>80);
 // Artificially corrupt *only the ephemeral browser cache*, never any real user cache.
 await page.evaluate(async()=>{
   const c=await caches.open('chartnova-v1');
   await c.put('/',new Response('<!doctype html><html><head><title>TEST-CORRUPT</title></head><body style="background:#000"></body></html>',{headers:{'content-type':'text/html; charset=utf-8'}}));
 });
 await page.reload({waitUntil:'domcontentloaded',timeout:16000});
 report.artificialBadCachedOfflineBlank=await page.evaluate(()=>
   document.title==='TEST-CORRUPT'&&!document.querySelector('.shell')&&
   (document.body?.innerText.length??0)===0);
 await ctx.setOffline(false);
 await page.reload({waitUntil:'domcontentloaded',timeout:16000});
 report.onlineRecoveredVisible=await page.evaluate(()=>
   !!document.querySelector('.shell')&&document.querySelector('.shell').getBoundingClientRect().width>80);
 report.pageErrors=exceptions;
 await ctx.close();
}finally{await browser.close()}
console.log('CHARTNOVA_V27_REAL_SW_CACHE_TEST '+JSON.stringify(report));
if(!report.validCachedOfflineVisible||!report.artificialBadCachedOfflineBlank||
   !report.onlineRecoveredVisible||report.pageErrors.length)process.exitCode=1;
