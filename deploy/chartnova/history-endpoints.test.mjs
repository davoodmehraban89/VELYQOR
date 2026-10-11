import worker from './worker.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const rows=Array.from({length:254},(_,i)=>{
  const d=new Date(Date.UTC(2025,9,13+i));
  return {date:d.toISOString().slice(0,10),close:1.05+Math.sin(i/20)*.08,quality:'GOOD'};
});
function envWith({exists=true}={}){
 const base={ok:true,symbol:'EUR_USD_ECB',source:'ECB',storage:'Neon PostgreSQL, mirrored via KV',dataKind:'daily_reference_point_not_ohlc',timeframe:'1D',quoteCurrency:'USD',attribution:'Source ECB',fetchedAt:new Date().toISOString(),count:254,series:rows};
 const kv=new Map(exists?[['history:ecb:EUR_USD_ECB:1y',JSON.stringify(base)],['downloads:chartnova-widget-3-v4','// Scriptable V4 fixture']]:[]);
 return {MARKET_CACHE:{get:async(k,t)=>{const r=kv.get(k);return t==='json'&&r?JSON.parse(r):r??null},put:async(k,v)=>kv.set(k,v)}};
}
const req=(p,method='GET')=>new Request('https://app.chartnova.ir'+p,{method});
test('one-year endpoint returns real-shape reference observations and provenance',async()=>{
 const response=await worker.fetch(req('/api/history?symbol=EUR_USD_ECB'),envWith());
 assert.equal(response.status,200);const d=await response.json();
 assert.equal(d.count,254);assert.equal(d.dataKind,'daily_reference_point_not_ohlc');assert.equal(d.source,'ECB');assert.equal(d.series.at(-1).date,'2026-06-23');assert.equal(d.quoteCurrency,'USD');
});
test('unsupported ticker is rejected',async()=>{const response=await worker.fetch(req('/api/history?symbol=../../users'),envWith());assert.equal(response.status,400);assert.equal((await response.json()).error,'unsupported_history_symbol')});
test('history not yet mirrored has explicit unavailability',async()=>{const response=await worker.fetch(req('/api/history?symbol=EUR_GBP_ECB'),envWith());assert.equal(response.status,503);assert.equal((await response.json()).error,'history_not_available')});
test('history request does not trigger upstream fetch or database creds',async()=>{const env=envWith();for(let i=0;i<10;i++){const response=await worker.fetch(req('/api/history?symbol=EUR_USD_ECB'),env);assert.equal(response.status,200)}});
test('Scriptable V4 download preserved',async()=>{const response=await worker.fetch(req('/downloads/ChartNova-3-Prices-V4.js'),envWith());assert.equal(response.status,200);assert((await response.text()).includes('Scriptable V4 fixture'));assert(response.headers.get('content-disposition').includes('ChartNova-3-Prices-V4.js'))});
test('widget download invalid/missing explicitly 404',async()=>{const response=await worker.fetch(req('/downloads/ChartNova-3-Prices-V4.js'),envWith({exists:false}));assert.equal(response.status,404)});
