/**
 * Reversible and fail-closed patch of the deployed ChartNova HTML bootstrap.
 * Leaves provider APIs, cached values, bindings and market data untouched.
 */
const beforeMarkets=' renderMarkets();renderTechnical();renderSelected();\n}\nasync function refresh(){';
const afterMarkets=[
 ' // Render only the visible view; do not repeatedly build hidden 58-card grids.',
 ' if(!el("markets").hidden)renderMarkets();',
 ' if(!el("technical").hidden)renderTechnical();',
 ' if(!el("dashboard").hidden)renderSelected();',
 ' if(!el("widget").hidden)renderWidget();',
 '}',
 'async function refresh(){'
].join('\n');
const beforeRefresh=[
 'async function refresh(){',
 ' el("status").textContent="در حال دریافت داده‌های ذخیره‌شده...";',
 ' await Promise.allSettled([loadDomestic(),loadGold(),loadMarkets()]);',
 ' renderSelected();renderMarkets();renderTechnical();',
 ' const age=Date.parse(marketState.receivedAt||"");',
 ' el("status").textContent=marketState.loaded?(Number.isFinite(age)&&Date.now()-age<=45*60000?"داده بازار به‌روز · بررسی هر ۱۵ دقیقه":"آخرین داده ذخیره‌شده · غیرلحظه‌ای"):"در انتظار داده نمادها · قیمت‌های موجود";',
 '}'
].join('\n');
const afterRefresh=[
 'let chartnovaRefreshInFlight=null;',
 'function refresh(){',
 ' if(chartnovaRefreshInFlight)return chartnovaRefreshInFlight;',
 ' const status=el("status");',
 ' status.textContent="در حال دریافت قیمت‌های اصلی...";',
 ' const onPrimaryLoaded=()=>{',
 '  if(!el("dashboard").hidden)renderSelected();',
 '  if(!marketState.loaded)status.textContent="قیمت‌های اصلی بررسی شدند · در حال دریافت نمادها...";',
 ' };',
 ' chartnovaRefreshInFlight=Promise.allSettled([',
 '  loadDomestic().finally(onPrimaryLoaded),',
 '  loadGold().finally(onPrimaryLoaded),',
 '  loadMarkets()',
 ' ]).then(()=>{',
 '  const age=Date.parse(marketState.receivedAt||"");',
 '  status.textContent=marketState.loaded?(Number.isFinite(age)&&Date.now()-age<=45*60000?',
 '   "داده بازار به‌روز · بررسی هر ۱۵ دقیقه":"آخرین داده ذخیره‌شده · غیرلحظه‌ای"):',
 '   "داده قیمت بررسی شد · نمادها در دسترس نیستند";',
 ' }).finally(()=>{chartnovaRefreshInFlight=null});',
 ' return chartnovaRefreshInFlight;',
 '}'
].join('\n');

function replaceExactlyOnce(value,oldPart,newPart,label){
 const count=value.split(oldPart).length-1;
 if(count!==1)throw new Error(label+' expected once, got '+count);
 return value.replace(oldPart,newPart);
}
export function optimizeChartNovaWorker(worker){
 if(typeof worker!=='string'||worker.length<10000)throw new Error('Unexpected Worker size');
 const anchor='return new Response("<!doctype html>';
 const start=worker.indexOf(anchor);
 const end=worker.indexOf('",{headers:{"content-type":"text/html; charset=utf-8"',start);
 if(start<0||end<0)throw new Error('Expected production HTML literal not found');
 const literalStart=start+'return new Response('.length;
 const htmlLiteral=worker.slice(literalStart,end+1);
 let html;try{html=JSON.parse(htmlLiteral)}catch{throw new Error('HTML literal is not valid JSON string')}
 const first=html.indexOf('<script>'),last=html.indexOf('</script>',first);
 if(first<0||last<0||html.indexOf('<script>',first+1)!==-1)throw new Error('Unexpected inline script count');
 const js=html.slice(first+8,last);
 let updated=replaceExactlyOnce(js,beforeMarkets,afterMarkets,'lazy view');
 updated=replaceExactlyOnce(updated,beforeRefresh,afterRefresh,'progressive refresh');
 const newHTML=html.slice(0,first+8)+updated+html.slice(last);
 if(newHTML.replace(updated,js)!==html)throw new Error('Unexpected HTML mutation');
 const result=worker.slice(0,literalStart)+JSON.stringify(newHTML)+worker.slice(end+1);
 if(result===worker)throw new Error('No source update');
 return {source:result,oldHTML:html,newHTML,oldJS:js,newJS:updated};
}
