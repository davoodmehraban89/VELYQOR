const assert=require('node:assert/strict');const {setTimeout:pause}=require('node:timers/promises');
const base='https://app.chartnova.ir';
async function get(path){let last;for(let i=0;i<3;i++){try{const r=await fetch(base+path,{signal:AbortSignal.timeout(14000),headers:{Accept:'application/json'}});const value=await r.json();return {status:r.status,value}}catch(e){last=e;await pause(500)}}throw last}
(async()=>{
 const requested=['GOLD18-IRT','USD-IRT','USDT-IRT','BTC-USD','EUR-IRT','SEKE-IRT'];
 const reply=await get('/api/widget?symbols='+requested.join(','));
 assert.equal(reply.status,200);assert.equal(reply.value.ok,true);
 assert.deepEqual(reply.value.items.map(x=>x.symbol),requested);
 assert.equal(reply.value.refreshAfterSeconds,900);
 assert.equal(reply.value.items[0].quote,'IRT');assert.equal(reply.value.items[3].quote,'USD');
 assert(reply.value.items.every(x=>Number.isFinite(x.price)&&x.price>0));
 console.log('PASS six ordered real quotes, currencies, gold and crypto',reply.value.source,reply.value.fetchedAt);
 const c=await get('/api/markets');assert.equal(c.status,200);assert(c.value.markets.length>=40);
 assert(c.value.markets.some(x=>x.symbol==='GOLD18-IRT'));
 console.log('PASS public catalog',c.value.markets.length);
 const tooMany=await get('/api/widget?symbols=USD-IRT,GOLD18-IRT,BTC-USD,EUR-IRT,USDT-IRT,SEKE-IRT,ETH-USD');
 assert.equal(tooMany.status,400);console.log('PASS cap six');
 const malformed=await get('/api/widget?symbols=%3Cscript%3E');
 assert.equal(malformed.status,400);console.log('PASS input validation');
 const unknown=await get('/api/widget?symbols=USD-IRT,NOTREAL-IRT');
 assert.equal(unknown.status,200);
 assert.deepEqual(unknown.value.missingSymbols,['NOTREAL-IRT']);
 console.log('PASS explicit missing symbols');
 console.log('ALL 5 LIVE API CHECKS PASSED');
})().catch(e=>{console.error('FAIL',e);process.exitCode=1});
