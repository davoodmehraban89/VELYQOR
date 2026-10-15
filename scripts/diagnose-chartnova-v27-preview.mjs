/**
 * Isolated, non-mutating browser diagnostic for already-existing v27 version URL.
 * NO Worker deploy, KV write, secret read, broker call or POST.
 * Browser /api/* requests are replaced with explicit test fixtures/503 replies.
 */
import { chromium, webkit } from 'playwright';
import { Script } from 'node:vm';

const V27='https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/';
const V26='https://app.chartnova.ir/';
const readHtml=async url=>{
 let response=null;
 for(let attempt=0;attempt<3;attempt++){
  try{ response=await fetch(url,{signal:AbortSignal.timeout(18000)}); if(response.ok)break; }
  catch(e){if(attempt===2)throw Error('versioned_HTML_network_unavailable_after_3_attempts');}
  if(attempt<2)await new Promise(done=>setTimeout(done,1000*(attempt+1)));
 }
 if(!response?.ok)throw Error('Unable to fetch versioned HTML after retries, HTTP '+response?.status);
 const html=await response.text();
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 if(!js||!html.includes('class="shell"'))throw Error('No classic ChartNova shell / JS in version URL');
 new Script(js,{filename:'chartnova-version-inline.js'});
 return {html,inlineBytes:js.length,version27Token:js.includes('chartnovaRefreshInFlight')};
};
const [candidate,prior]=await Promise.all([readHtml(V27),readHtml(V26)]);
if(!candidate.version27Token||prior.version27Token)throw Error('Version URL not proven distinct from rolled-back production v26');

const results=[];
let fail=false;
const scenarios=[
 {browser:'chromium',name:'fresh-503',engine:chromium,delay:0,market:'503',sw:'block',reload:true},
 {browser:'chromium',name:'slow-feed',engine:chromium,delay:7000,market:'503',sw:'block',reload:false},
 {browser:'chromium',name:'sw-allowed-503',engine:chromium,delay:0,market:'503',sw:'allow',reload:true},
 {browser:'webkit',name:'fresh-503',engine:webkit,delay:0,market:'503',sw:'block',reload:true},
 {browser:'webkit',name:'slow-feed',engine:webkit,delay:7000,market:'503',sw:'block',reload:false}
];
for(const spec of scenarios){
 const browser=await spec.engine.launch({headless:true});
 try{
  const context=await browser.newContext({
   viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   serviceWorkers:spec.sw
  });
  // Every XHR/REST request is fulfilled locally so no provider, KV, DB or user account is touched.
  let calls=0;
  await context.route('**/api/**',async route=>{
   calls++;
   if(route.request().url().includes('/api/markets')&&spec.delay)await new Promise(resolve=>setTimeout(resolve,spec.delay));
   await route.fulfill({status:503,contentType:'application/json',
      headers:{'cache-control':'no-store'},
      body:JSON.stringify({ok:false,error:'STAGE2_SIMULATED_SOURCE_UNAVAILABLE'})});
  });
  await context.route('**/sw.js',route=>route.fulfill({status:200,contentType:'application/javascript',
    body:'self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));'}));
  await context.route(V27,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:candidate.html}));
  const page=await context.newPage();
  const failures=[],consoleErrors=[],jsExceptions=[];
  page.on('pageerror',e=>jsExceptions.push({name:e.name||'Error',message:String(e.message).slice(0,220),stack:String(e.stack).slice(0,440)}));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,240))});
  page.on('requestfailed',r=>{
   if(failures.length<8)failures.push({path:new URL(r.url()).pathname,reason:r.failure()?.errorText||'unknown'});
  });
  async function measure(){
    return await page.evaluate(()=>{
     const shell=document.querySelector('.shell');
     const rect=shell?.getBoundingClientRect();
     const style=shell?getComputedStyle(shell):null;
     return {readyState:document.readyState,htmlLoaded:!!shell,
      title:document.title,bodyTextChars:document.body?.innerText.length||0,
      shellVisible:!!rect&&rect.width>100&&rect.height>100&&style.display!=='none'&&style.visibility!=='hidden',
      dashboardVisible:document.getElementById('dashboard')?.hidden===false,
      status:(document.getElementById('status')?.textContent||'').slice(0,140),
      swController:!!navigator.serviceWorker?.controller};
    });
  }
  const a={scenario:spec.name,browser:spec.browser,serviceWorkers:spec.sw,fixtureOnly:true};
  try{
   const response=await page.goto(V27,{waitUntil:'domcontentloaded',timeout:20000});
   a.status=response?.status()??null;
   await page.waitForTimeout(spec.delay?1400:1900);
   a.initial=await measure();
   if(spec.delay)await page.waitForTimeout(spec.delay+700);
   else await page.waitForTimeout(800);
   a.after=await measure();
   if(spec.reload){
     await page.reload({waitUntil:'domcontentloaded',timeout:20000});
     await page.waitForTimeout(1400);
     a.reloaded=await measure();
   }
   a.requestsIntercepted=calls;
   a.jsExceptions=jsExceptions;
   a.consoleErrors=consoleErrors;
   a.failedRequests=failures;
   if(a.status!==200||!a.initial?.shellVisible||!a.after?.shellVisible||
      (a.reloaded&&!a.reloaded.shellVisible)||jsExceptions.length)fail=true;
  }catch(e){
    a.testError=String(e.message||e).slice(0,330);
    fail=true;
  }
  results.push(a);await context.close();
 }finally{await browser.close()}
}
const report={
 conclusion:fail?'REPRODUCED_OR_TEST_FAILURE':'NOT_REPRODUCED_IN_TESTED_SCENARIOS',
 versionPreview:V27,productionOnlyRead:V26,
 v27InlineLength:candidate.inlineBytes,
 v26InlineLength:prior.inlineBytes,
 versionIdentityProved: candidate.version27Token&&!prior.version27Token,
 scenarios:results
};
console.log('CHARTNOVA_V27_ISOLATED_DIAGNOSTIC '+JSON.stringify(report));
if(fail)process.exitCode=1;
