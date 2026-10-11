import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import worker from "./worker.mjs";

function sample(symbol,price=100000) {return {symbol,name:"نام "+symbol,quote:"IRT",sellPrice:price,change:-0.4,updatedAt:"2026-10-11T12:00:00.000Z",isUpToDate:true,history:[price,price+1]}}
const catalog={ok:true,source:"gheymat.online",fetchedAt:new Date().toISOString(),markets:[sample("USD-IRT",265000),sample("GOLD18-IRT",26300000),sample("USDT-IRT",265100),sample("EUR-IRT",305000),sample("BTC-USD",100000)]};
function mock(catalogData=catalog){const values=new Map(catalogData?[["markets:gheymat:v1",JSON.stringify(catalogData)]]:[]);return{env:{MARKET_CACHE:{get:async(k,type)=>{const v=values.get(k);return type==="json"&&v?JSON.parse(v):v??null}}},values}}
async function api(url,env){const response=await worker.fetch(new Request("https://preview.chartnova.test"+url),env);return {status:response.status,data:await response.json(),headers:response.headers}}

test("widget API returns exact requested symbols in requested order",async()=>{
 const {env}=mock();const r=await api("/api/widget?symbols=GOLD18-IRT,USD-IRT,BTC-USD",env);
 assert.equal(r.status,200);assert.deepEqual(r.data.items.map(x=>x.symbol),["GOLD18-IRT","USD-IRT","BTC-USD"]);
 assert.equal(r.data.items[0].price,26300000);assert.equal(r.data.items[2].quote,"IRT"); // fixture market quote deliberately IRT
 assert.equal(r.data.refreshAfterSeconds,900);assert.equal(r.data.quoteSide,"sell");assert.equal(r.headers.get("cache-control"),"no-store")
});
test("widget API defaults to four favorites",async()=>{const r=await api("/api/widget",mock().env);assert.deepEqual(r.data.items.map(x=>x.symbol),["USD-IRT","GOLD18-IRT","USDT-IRT","EUR-IRT"])});
test("widget API ignores repeated symbol and identifies unknown",async()=>{const r=await api("/api/widget?symbols=USD-IRT,USD-IRT,ZZZ-IRT",mock().env);assert.deepEqual(r.data.items.map(x=>x.symbol),["USD-IRT"]);assert.deepEqual(r.data.missingSymbols,["ZZZ-IRT"])});
test("widget endpoint rejects excessive, malformed, empty selections",async()=>{for(const path of ["/api/widget?symbols=","/api/widget?symbols=USD-IRT,EUR-IRT,X-IRT,Y-IRT,Z-IRT,W-IRT,Q-IRT","/api/widget?symbols=USD-IRT,%3Cscript%3E"]){const r=await api(path,mock().env);assert.equal(r.status,400);assert.equal(r.data.ok,false)}});
test("widget feed unavailable is explicit 503",async()=>{const r=await api("/api/widget?symbols=USD-IRT",mock(null).env);assert.equal(r.status,503);assert.equal(r.data.ok,false)});
test("widget data read does not hit upstream or spend free quota",async()=>{let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error("unexpected upstream request")};try{const {env}=mock();for(let i=0;i<20;i++){const r=await api("/api/widget",env);assert.equal(r.status,200)}assert.equal(calls,0)}finally{globalThis.fetch=old}});
function preferences(saved){
 const storage=new Map;if(saved!==undefined)storage.set("chartnova-widget-prefs-v1",saved);
 const ctx={localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{},el:()=>null,renderWidget:()=>{},renderMarkets:()=>{},instrument:s=>catalog.markets.find(m=>m.symbol===s)};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL("./widget-ui.js",import.meta.url),"utf8"),ctx);
 return {state:()=>JSON.parse(JSON.stringify(vm.runInContext("widgetState",ctx))),act:code=>vm.runInContext(code,ctx),storage};
}
test("default configuration contains mixed currency and 18k gold",()=>{const f=preferences();assert.deepEqual(f.state().symbols,["USD-IRT","GOLD18-IRT","USDT-IRT","EUR-IRT"]);assert.equal(f.state().theme,"glass")});
test("preferences remove duplicates, invalid tickers and invalid themes",()=>{
 const f=preferences(JSON.stringify({symbols:["USD-IRT","USD-IRT","<script>","GOLD18-IRT"],favorites:["EUR-IRT","EUR-IRT","<script>"],theme:"bogus",size:"large"}));
 assert.deepEqual(f.state().symbols,["USD-IRT","GOLD18-IRT"]);assert.deepEqual(f.state().favorites,["EUR-IRT"]);assert.equal(f.state().theme,"glass");assert.equal(f.state().size,"large");
});
test("configurator adds favorite, reorders, removes and persists",()=>{
 const f=preferences();f.act('favoriteSymbol("BTC-USD")');assert.ok(f.state().favorites.includes("BTC-USD"));
 f.act('addWidgetSymbol("BTC-USD")');assert.ok(f.state().symbols.includes("BTC-USD"));
 f.act('moveWidgetSymbol("BTC-USD",-1)');assert.equal(f.state().symbols.at(-2),"BTC-USD");
 f.act('removeWidgetSymbol("EUR-IRT")');assert.ok(!f.state().symbols.includes("EUR-IRT"));
 f.act('changeWidgetSetting("size","large")');f.act('changeWidgetSetting("theme","dark")');
 assert.equal(f.state().size,"large");assert.equal(f.state().theme,"dark");assert.equal(JSON.parse(f.storage.get("chartnova-widget-prefs-v1")).theme,"dark");
});
test("configurator caps selection to six, rejects unknown symbols",()=>{
 const f=preferences();assert.equal(f.act('addWidgetSymbol("BTC-USD")'),true);
 assert.equal(f.act('addWidgetSymbol("X-IRT")'),false);
 assert.equal(f.act('addWidgetSymbol("USD-IRT")'),false);
});
