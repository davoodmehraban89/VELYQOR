import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { optimizeChartNovaWorker } from './optimize-chartnova-worker.mjs';

const oldJS=[
 'const marketState={loaded:false,receivedAt:null};',
 'function el(id){return document.getElementById(id)}',
 'function renderMarkets(){} function renderTechnical(){} function renderSelected(){} function renderWidget(){}',
 'async function loadDomestic(){} async function loadGold(){}',
 'async function loadMarkets(){',
 ' marketState.loaded=true;',
 ' renderMarkets();renderTechnical();renderSelected();',
 '}',
 'async function refresh(){',
 ' el("status").textContent="در حال دریافت داده‌های ذخیره‌شده...";',
 ' await Promise.allSettled([loadDomestic(),loadGold(),loadMarkets()]);',
 ' renderSelected();renderMarkets();renderTechnical();',
 ' const age=Date.parse(marketState.receivedAt||"");',
 ' el("status").textContent=marketState.loaded?(Number.isFinite(age)&&Date.now()-age<=45*60000?"داده بازار به‌روز · بررسی هر ۱۵ دقیقه":"آخرین داده ذخیره‌شده · غیرلحظه‌ای"):"در انتظار داده نمادها · قیمت‌های موجود";',
 '}'
].join('\n');
function fixture(js=oldJS){
 const html='<!doctype html><html><body><div id="status"></div><script>'+js+'</script></body></html>';
 const boiler='const OTHER_API_ROUTE="/api/markets";\nconst untouched='+JSON.stringify('x'.repeat(10500))+';\n';
 return 'export default { async fetch(request,env){'+boiler+
  'return new Response('+JSON.stringify(html)+',{headers:{"content-type":"text/html; charset=utf-8"}})},'+
  'async scheduled(event,env){} }';
}
test('changes only HTML inline JS; keeps Worker API and scheduler exact',()=>{
 const source=fixture();
 const result=optimizeChartNovaWorker(source);
 assert.ok(result.newJS.includes('chartnovaRefreshInFlight'));
 assert.ok(result.newJS.includes('if(!el("markets").hidden)renderMarkets()'));
 assert.ok(result.newJS.includes('loadDomestic().finally(onPrimaryLoaded)'));
 assert.ok(!result.newJS.includes('renderSelected();renderMarkets();renderTechnical();'));
 assert.ok(result.source.includes('const OTHER_API_ROUTE="/api/markets"'));
 assert.ok(result.source.includes('async scheduled(event,env){}'));
 assert.equal(result.newHTML.replace(result.newJS,result.oldJS),result.oldHTML);
 assert.doesNotThrow(()=>new Script(result.newJS));
 const originalPrefix=source.slice(0,source.indexOf('return new Response("<!doctype html>'));
 const modifiedPrefix=result.source.slice(0,result.source.indexOf('return new Response("<!doctype html>'));
 assert.equal(modifiedPrefix,originalPrefix);
});
test('blocks nonmatching source instead of speculative regex modification',()=>{
 assert.throws(()=>optimizeChartNovaWorker('bad source'),/size/);
 assert.throws(()=>optimizeChartNovaWorker(fixture(oldJS.replace('renderMarkets();renderTechnical();renderSelected();','renderMarkets();'))),/expected once/);
});
test('does not apply twice; protects against hidden drift',()=>{
 const newSource=optimizeChartNovaWorker(fixture()).source;
 assert.throws(()=>optimizeChartNovaWorker(newSource),/expected once/);
});
test('prevents accidental modification of multiple scripts',()=>{
 const js=oldJS+'</script><script>window.alert(2)';
 assert.throws(()=>optimizeChartNovaWorker(fixture(js)),/script count/);
});
