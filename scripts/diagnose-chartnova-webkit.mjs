import { webkit, devices } from 'playwright';
const HOST='https://app.chartnova.ir/';
const result={checkedAt:new Date().toISOString(),browser:'Playwright WebKit on Ubuntu (Safari-like, not iOS device)',cases:[]};
let failed=false;
const browser=await webkit.launch({headless:true});
try{
  for(const variant of [
    {name:'webkit-iphone-fresh-sw-disabled',serviceWorkers:'block'},
    {name:'webkit-iphone-fresh-sw-allowed',serviceWorkers:'allow'}
  ]){
    const context=await browser.newContext({...devices['iPhone 13'],serviceWorkers:variant.serviceWorkers});
    const page=await context.newPage(),one={name:variant.name,errors:[],console:[],failedRequests:[]};
    page.on('pageerror',e=>one.errors.push(e.message.slice(0,500)));
    page.on('console',m=>{if(m.type()==='error')one.console.push(m.text().slice(0,300))});
    page.on('requestfailed',r=>{if(one.failedRequests.length<10)one.failedRequests.push({path:new URL(r.url()).pathname,reason:r.failure()?.errorText})});
    try{
      const r=await page.goto(HOST,{waitUntil:'domcontentloaded',timeout:25000});
      await page.waitForTimeout(3800);
      one.status=r?.status();
      one.dom=await page.evaluate(()=>({
        title:document.title,
        bodyChars:document.body?.innerText.length??0,
        shell:!!document.querySelector('.shell'),
        shellWidth:document.querySelector('.shell')?.getBoundingClientRect().width??0,
        dashboardVisible:document.querySelector('#dashboard')?.hidden===false,
        marketStatus:document.querySelector('#status')?.textContent?.slice(0,150)??null,
        swControlled:!!navigator.serviceWorker?.controller,
        theme:document.body.className
      }));
      if(one.status!==200||!one.dom.shell||one.dom.bodyChars<90||one.errors.length)failed=true;
    }catch(e){failed=true;one.navigationError=String(e.message??e).slice(0,300)}
    result.cases.push(one);
    await context.close();
  }
}finally{await browser.close()}
console.log('CHARTNOVA_WEBKIT_BROWSER_DIAGNOSTIC '+JSON.stringify(result));
if(failed)process.exitCode=1;
