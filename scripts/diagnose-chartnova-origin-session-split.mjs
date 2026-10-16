/**
 * Read-only production-origins A/B browser diagnostic.
 *
 * Uses GET only to download PUBLIC HTML + service workers. Browser fetch of
 * app API endpoints is ALWAYS intercepted and fulfilled with synthetic 503.
 * Cache poisoning is restricted to a DISPOSABLE Chromium browser context.
 * Nothing on Cloudflare, production, user devices or persistent storage changes.
 *
 * A "fresh context" mimics a new browser session, NOT Safari Private exactly.
 */
import {chromium,webkit} from 'playwright';
import {createHash} from 'node:crypto';

const sites=[
 {name:'root',base:'https://chartnova.ir/'},
 {name:'app',base:'https://app.chartnova.ir/'}
];
async function getPublic(url){
 for(let tries=1;tries<=3;tries++){
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'cache-control':'no-cache'}});
   if(r.ok)return r.text();
  }catch{}
  if(tries<3)await new Promise(ok=>setTimeout(ok,tries*900));
 }
 throw Error('EXTERNAL_GET_UNAVAILABLE '+new URL(url).hostname);
}
const assets={};
for(const {name,base} of sites){
 const [html,sw]=await Promise.all([getPublic(base),getPublic(base+'sw.js')]);
 if(!html.includes('class="shell"')||!sw.includes("chartnova-v1"))
  throw Error('Unexpected public UI or SW version at '+name);
 assets[name]={html,sw};
}
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const report={
 rootAndAppHTMLByteIdentical:assets.root.html===assets.app.html,
 rootAndAppServiceWorkerByteIdentical:assets.root.sw===assets.app.sw,
 sha256:{rootHTML:sha(assets.root.html),appHTML:sha(assets.app.html),
 rootSW:sha(assets.root.sw),appSW:sha(assets.app.sw)},
 results:[],simulatedOriginSplit:null,realUserReproduction:false
};
function setupRoutes(context){
 return Promise.all(sites.map(({name,base})=>Promise.all([
  context.route(base,route=>route.fulfill({
   status:200,contentType:'text/html; charset=utf-8',body:assets[name].html
  })),
  context.route(base+'sw.js',route=>route.fulfill({
   status:200,contentType:'application/javascript',body:assets[name].sw
  })),
  context.route(base+'icon.svg',route=>route.fulfill({
   status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'
  })),
  context.route(base+'manifest.webmanifest',route=>route.fulfill({
   status:200,contentType:'application/manifest+json',
   body:'{"name":"Incident diagnostic","start_url":"/"}'
  }))
 ]))).then(()=>context.route('**/api/**',route=>route.fulfill({
  status:503,contentType:'application/json',
  headers:{'cache-control':'no-store'},
  body:'{"ok":false,"error":"CONTROLLED_SOURCE_OUTAGE_NO_LIVE_API"}'
 })));
}
async function visible(page){
 return page.evaluate(()=>{
  const el=document.querySelector('.shell');
  const b=el?.getBoundingClientRect();
  return !!b&&b.width>100&&b.height>100;
 });
}
async function open(page,url){
 const e=[];
 page.on('pageerror',x=>e.push(String(x.message).slice(0,160)));
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:22000});
 await page.waitForTimeout(1000);
 return {http:response?.status(),visible:await visible(page),jsExceptions:e};
}
let fail=false;
for(const {name,engine} of [{name:'Chromium',engine:chromium},{name:'WebKit',engine:webkit}]){
 const browser=await engine.launch({headless:true});
 try{
  // Independently fresh profiles: not the owner's normal or private profile.
  for(const {name:origin,base} of sites){
   const context=await browser.newContext({viewport:{width:390,height:844},
     isMobile:true,hasTouch:true,serviceWorkers:'block'});
   await setupRoutes(context);
   const page=await context.newPage();
   const r=await open(page,base);
   report.results.push({browser:name,origin,session:'new-disposable-profile',...r});
   if(r.http!==200||!r.visible||r.jsExceptions.length)fail=true;
   await context.close();
  }
  if(name!=='Chromium')continue;
  const context=await browser.newContext({viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,serviceWorkers:'allow'});
  await setupRoutes(context);
  const rootPage=await context.newPage(),appPage=await context.newPage();
  let root=await open(rootPage,sites[0].base);
  let app=await open(appPage,sites[1].base);
  await rootPage.waitForFunction(()=>!!navigator.serviceWorker.controller,undefined,{timeout:14000});
  await appPage.waitForFunction(()=>!!navigator.serviceWorker.controller,undefined,{timeout:14000});
  const beforeRoot=await rootPage.evaluate(async()=>{
    const list=await caches.keys();return {keys:list,hasPage:!!(await (await caches.open('chartnova-v1')).match('/'))}
  });
  const beforeApp=await appPage.evaluate(async()=>{
    const list=await caches.keys();return {keys:list,hasPage:!!(await (await caches.open('chartnova-v1')).match('/'))}
  });
  // Pretend corruption in root's cache ONLY inside ephemeral browser storage.
  await rootPage.evaluate(async()=>{
   const cache=await caches.open('chartnova-v1');
   await cache.put('/',new Response('<!doctype html><html><title>SIMULATED_BAD_ROOT_CACHE</title><body></body></html>',{
     headers:{'content-type':'text/html; charset=utf-8'}
   }));
  });
  let offline=false;
  // Fail all navigation network requests before SW fallback.
  await context.unroute(sites[0].base);
  await context.unroute(sites[1].base);
  await context.route(sites[0].base,r=>offline?r.abort('internetdisconnected'):
    r.fulfill({status:200,contentType:'text/html',body:assets.root.html}));
  await context.route(sites[1].base,r=>offline?r.abort('internetdisconnected'):
    r.fulfill({status:200,contentType:'text/html',body:assets.app.html}));
  offline=true;
  await context.setOffline(true);
  await rootPage.reload({waitUntil:'domcontentloaded',timeout:22000});
  const rootBlank=!(await visible(rootPage));
  await appPage.reload({waitUntil:'domcontentloaded',timeout:22000});
  const appVisible=await visible(appPage);
  offline=false;
  await context.setOffline(false);
  await rootPage.reload({waitUntil:'domcontentloaded',timeout:22000});
  const rootRecovered=await visible(rootPage);
  report.simulatedOriginSplit={
    rootAndAppInitiallyVisible:root.visible&&app.visible,
    rootAndAppHaveSeparateOriginCache:beforeRoot.hasPage&&beforeApp.hasPage,
    rootWasBlankWithDeliberatelyCorruptCacheAndOffline:rootBlank,
    appStayedVisibleWithHealthyCacheAndOffline:appVisible,
    rootRecoveredOnline:rootRecovered,
    disposableBrowserOnly:true,
    doesNotEstablishOwnersCause:true
  };
  if(!Object.values(report.simulatedOriginSplit).slice(0,5).every(Boolean))fail=true;
  await context.close();
 }finally{await browser.close()}
}
console.log('CHARTNOVA_ORIGIN_BROWSER_DIAGNOSTIC '+JSON.stringify(report));
if(!report.rootAndAppHTMLByteIdentical||!report.rootAndAppServiceWorkerByteIdentical||fail)
 process.exitCode=1;
