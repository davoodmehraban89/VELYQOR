import { chromium } from 'playwright';

const candidates=[
 {name:'candidate-version-27',url:'https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/'},
 {name:'current-production',url:'https://app.chartnova.ir/'}
];
const browser=await chromium.launch({headless:true});
let failed=false;
const results=[];
try{
 for(const target of candidates){
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await ctx.newPage();
   const errors=[],badRequests=[];
   page.on('pageerror',e=>errors.push(String(e.message).slice(0,280)));
   page.on('requestfailed',r=>badRequests.push({path:new URL(r.url()).pathname,reason:r.failure()?.errorText}));
   await page.addInitScript(()=>{
     window.__chartnovaPaint={};
     document.addEventListener('DOMContentLoaded',()=>{
       for(const name of ['usd','gold18','xau','status']){
         const el=document.getElementById(name);
         if(!el)continue;
         const observe=()=>{
           const content=el.textContent||'';
           const p=window.__chartnovaPaint;
           if(name==='status'&&content.includes('قیمت‌های اصلی')&&!p.primaryStatusMs)p.primaryStatusMs=Math.round(performance.now());
           if(name==='status'&&content.includes('داده بازار به‌روز')&&!p.completeMs)p.completeMs=Math.round(performance.now());
           if(name==='usd'&&!content.includes('در حال دریافت')&&content.trim()&&!p.usdMs)p.usdMs=Math.round(performance.now());
           if(name==='gold18'&&!content.includes('در حال دریافت')&&content.trim()&&!p.goldMs)p.goldMs=Math.round(performance.now());
           if(name==='xau'&&!content.includes('در حال دریافت')&&content.trim()&&!p.xauMs)p.xauMs=Math.round(performance.now());
         };
         new MutationObserver(observe).observe(el,{characterData:true,childList:true,subtree:true});
         observe();
       }
     },{once:true});
   });
   let stats={name:target.name};
   try{
     const res=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:18000});
     stats.htmlStatus=res?.status();
     await page.waitForFunction(()=>{
       const m=document.getElementById('status')?.textContent||'';
       return m.includes('به‌روز')||m.includes('غیرلحظه‌ای')||m.includes('در دسترس نیستند');
     },{timeout:15000}).catch(()=>{});
     await page.waitForTimeout(1000);
     stats.ui=await page.evaluate(()=>({
       title:document.title,visible:!!document.querySelector('.shell')?.getBoundingClientRect().width,
       quoteUsd:document.getElementById('usd')?.textContent?.slice(0,80),
       quoteGold:document.getElementById('gold18')?.textContent?.slice(0,80),
       quoteXau:document.getElementById('xau')?.textContent?.slice(0,80),
       status:document.getElementById('status')?.textContent?.slice(0,140),
       markets:document.getElementById('marketCount')?.textContent?.slice(0,120),
       marks:window.__chartnovaPaint
     }));
     await page.locator('[data-nav="markets"]').first().click();
     stats.marketTab=await page.locator('#marketgrid .marketitem').count();
     await page.locator('[data-nav="technical"]').first().click();
     stats.technicalTab=await page.locator('#techTitle').textContent();
     stats.errors=errors;stats.failedRequests=badRequests.slice(0,8);
     if(stats.htmlStatus!==200||!stats.ui.visible||stats.marketTab<10||errors.length)failed=true;
   }catch(e){failed=true;stats.error=String(e).slice(0,430);}
   results.push(stats);await ctx.close();
 }
}finally{await browser.close()}
console.log('CHARTNOVA_PRODUCTION_VS_STAGED_PERFORMANCE '+JSON.stringify(results));
if(failed)process.exitCode=1;
