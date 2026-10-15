import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const tested=[];
let failed=false;
try{
 for(const target of [
   {name:'candidate-progressive',url:'https://2cbeb4e2-velyqor-preview.davoodmehraban89.workers.dev/',expectsProgressive:true},
   {name:'prior-production',url:'https://app.chartnova.ir/',expectsProgressive:false}
 ]){
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',x=>errors.push(x.message));
   await page.route('**/api/markets',async route=>{
     await new Promise(done=>setTimeout(done,10000));
     try{await route.continue()}catch{}
   });
   const response=await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:15000});
   await page.waitForFunction(()=>{
     const usd=document.getElementById('usd')?.textContent||'';
     const gold=document.getElementById('gold18')?.textContent||'';
     return usd.includes('تومان')&&gold.includes('تومان');
   },undefined,{timeout:8000});
   const early=await page.evaluate(()=>({
     usd:document.getElementById('usd')?.textContent,
     gold:document.getElementById('gold18')?.textContent,
     status:document.getElementById('status')?.textContent,
     hiddenMarketCards:document.querySelectorAll('#marketgrid .marketitem').length
   }));
   await page.waitForFunction(()=>document.getElementById('status')?.textContent?.includes('داده بازار به‌روز'),undefined,{timeout:15000});
   const finalState=await page.evaluate(()=>({status:document.getElementById('status')?.textContent,
     hiddenMarketCards:document.querySelectorAll('#marketgrid .marketitem').length}));
   await page.locator('[data-nav="markets"]').first().click();
   const displayedMarketCards=await page.locator('#marketgrid .marketitem').count();
   tested.push({name:target.name,httpStatus:response?.status(),early,finalState,displayedMarketCards,errors});
   if(target.expectsProgressive && (!early.status?.includes('قیمت‌های اصلی')||
       early.hiddenMarketCards!==0||displayedMarketCards<50||errors.length))failed=true;
   await ctx.close();
 }
}finally{await browser.close()}
console.log('CHARTNOVA_SLOW_FEED_TEST '+JSON.stringify(tested));
if(failed)process.exitCode=1;
