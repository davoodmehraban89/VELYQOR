import test from 'node:test';
import assert from 'node:assert/strict';
import {marketCatalogSummary} from '../src/market-catalog-summary.mjs';
const now=Date.parse('2026-10-15T11:00:00Z');
function item(symbol='USD-IRT'){
 const [base,quote]=symbol.split('-');
 return {symbol,name:'دلار آمریکا',base,quote,category:'CURRENCY',
 sellPrice:100000,buyPrice:100005,change:0.5,
 updatedAt:'2026-10-15T10:55:00Z',isUpToDate:true,
 history:Array.from({length:168},(_,i)=>100000+i)};
}
function catalog(markets=[item()]){
 return {ok:true,source:'gheymat.online',fetchedAt:'2026-10-15T10:59:00Z',markets};
}
test('projects a valid catalog without carrying time series or private fields',()=>{
 const full=catalog();
 full.markets[0].providerToken='never-expose';
 const s=marketCatalogSummary(full,now);
 assert.equal(s.ok,true);assert.equal(s.markets[0].history,undefined);
 assert.equal(s.markets[0].providerToken,undefined);
 assert.equal(s.markets[0].historyCount,168);
 assert.equal(s.markets[0].quote,'IRT');
 assert.equal(s.markets[0].sellPrice,100000);
 assert.equal(s.markets[0].buyPrice,100005);
 assert.equal(s.markets[0].historyKind,'provider_price_points_not_ohlc');
 assert.equal(s.dataKind,'provider_market_snapshots_not_executable_quotes');
});
test('verified input remains immutable across projection',()=>{
 const orig=catalog();const json=JSON.stringify(orig);
 const snapshot=marketCatalogSummary(orig,now);
 snapshot.markets[0].sellPrice=1;
 assert.equal(JSON.stringify(orig),json);
 assert.equal(orig.markets[0].sellPrice,100000);
});
test('typical 58-market 168-observation payload loses at least 70% bytes',()=>{
 const arr=Array.from({length:58},(_,i)=>item('S'+String(i+1).padStart(3,'0')+'-IRT'));
 const full=catalog(arr),snapshot=marketCatalogSummary(full,now);
 assert.equal(snapshot.markets.length,58);
 assert.ok(JSON.stringify(snapshot).length<JSON.stringify(full).length*.3);
});
test('preserves upstream provider time and stale signal without pretending live ticks',()=>{
 const s=marketCatalogSummary({...catalog(),fetchedAt:'2026-10-15T10:00:00Z'},now);
 assert.equal(s.stale,true);assert.equal(s.quoteSide,'sell');
 assert.equal(s.fetchedAt,'2026-10-15T10:00:00Z');
});
test('rejects unknown provider or missing original proof',()=>{
 for(const raw of [null,{},catalog([]),{...catalog(),source:'made-up-feed'}, {...catalog(),ok:false}])
   assert.deepEqual(marketCatalogSummary(raw,now),{ok:false,error:'market_data_not_collected'});
});
test('rejects duplicate symbols, no guessed units and malformed amounts',()=>{
 const dup=catalog([item('USD-IRT'),item('USD-IRT')]);
 const mismatch=catalog([{...item(),quote:'IRR'}]);
 const negative=catalog([{...item(),sellPrice:-5}]);
 const nan=catalog([{...item(),buyPrice:NaN}]);
 for(const raw of [dup,mismatch,negative,nan])
   assert.equal(marketCatalogSummary(raw,now).ok,false);
});
test('does not silently accept timestamps from the future',()=>{
 assert.equal(marketCatalogSummary({...catalog(),fetchedAt:'2026-10-16T12:00:00Z'},now).ok,false);
 assert.equal(marketCatalogSummary(catalog([{...item(),updatedAt:'2099-01-01T00:00:00Z'}]),now).ok,false);
});
test('rejects invalid, fabricated and oversized historical arrays',()=>{
 for(const h of [['oops'],[null],[Infinity],Array.from({length:169},()=>100)])
   assert.equal(marketCatalogSummary(catalog([{...item(),history:h}]),now).ok,false);
});
test('allows missing historical series only when provider explicitly reports zero points',()=>{
 const full=catalog([{...item(),history:[]}]);
 const s=marketCatalogSummary(full,now);
 assert.equal(s.ok,true);
 assert.equal(s.markets[0].historyCount,0);
});
test('rejects oversized catalog and invalid clock',()=>{
 const big=catalog(Array.from({length:201},(_,i)=>item('S'+String(i+1).padStart(3,'0')+'-IRT')));
 assert.equal(marketCatalogSummary(big,now).ok,false);
 assert.equal(marketCatalogSummary(catalog(),NaN).ok,false);
});
