import worker from "./worker.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
let succeeded=0;const check=async(name,fn)=>{await fn();succeeded++;console.log("PASS",name)};
const day=new Date().toISOString().slice(0,10);
function store(){const kv=new Map;return{kv,env:{MARKET_CACHE:{get:async(k,type)=>{const v=kv.get(k);return type==="json"&&v?JSON.parse(v):v??null},put:async(k,v)=>{kv.set(k,v)}}}}}
function item(symbol,price=225000,category="CURRENCY"){return{symbol,price_source:{symbol:"GHEYMAT"},name:{fa:"نماد "+symbol},base_currency:{symbol:symbol.split("-")[0],category:{symbol:category}},quote_currency:{symbol:symbol.split("-")[1]},sell_price:String(price),buy_price:String(price+100),change:"-0.35",created_at:new Date().toISOString(),is_up_to_date:true,chart:Array.from({length:168},(_,i)=>price-300+i*2)}}
const marketResponse=()=>new Response(JSON.stringify({data:[item("USD-IRT",265060),item("GOLD18-IRT",26235860,"GOLD"),item("BTC-USD",99000,"CRYPTOCURRENCY"),item("SEKE-IRT",105000000,"COIN")]}),{status:200});
const req=(p)=>new Request("https://chartnova.test"+p);
async function main(){
 const a=store();let called=0;globalThis.fetch=async()=>{called++;return marketResponse()};
 await worker.scheduled({cron:"*/15 * * * *"},a.env);
 await check("catalog saved with real ticker identifiers",async()=>{const x=JSON.parse(a.kv.get("markets:gheymat:v1"));assert.equal(x.markets.length,4);assert.deepEqual(x.markets.map(m=>m.symbol),["USD-IRT","GOLD18-IRT","BTC-USD","SEKE-IRT"]);assert.equal(x.markets[0].history.length,168)});
 await check("catalog GET HTTP and source",async()=>{const resp=await worker.fetch(req("/api/markets"),a.env);assert.equal(resp.status,200);const x=await resp.json();assert.equal(x.source,"gheymat.online");assert.equal(x.markets.length,4);assert.equal(x.stale,false)});
 await check("query individual ticker filters server side",async()=>{const x=await(await worker.fetch(req("/api/markets?symbol=BTC-USD"),a.env)).json();assert.equal(x.markets.length,1);assert.equal(x.markets[0].symbol,"BTC-USD")});
 await check("invalid symbol input 400",async()=>{const r=await worker.fetch(req("/api/markets?symbol=%3Cscript%3E"),a.env);assert.equal(r.status,400)});
 await check("browser fetch is KV only no quota use",async()=>{for(let i=0;i<10;i++)await worker.fetch(req("/api/markets"),a.env);assert.equal(called,1)});
 await check("market data does not alter domestic Oanor fallback contract",async()=>{const d=await(await worker.fetch(req("/api/domestic"),a.env)).json();assert.equal(d.ok,true);assert.equal(d.source,"gheymat.online");assert.equal(d.gold18.price,26235860)});
 await check("quota boundary avoids 201st request",async()=>{a.kv.set("domestic:gheymat:count:"+day,"200");await worker.scheduled({cron:"*/15 * * * *"},a.env);assert.equal(called,1)});
 const b=store();b.kv.set("domestic:gheymat:count:"+day,"200");b.kv.set("markets:gheymat:v1",a.kv.get("markets:gheymat:v1"));
 await check("exhausted quota still serves stored catalog",async()=>{const x=await(await worker.fetch(req("/api/markets"),b.env)).json();assert.equal(x.markets.length,4)});
 const c=store();const good=await(await worker.fetch(req("/api/markets"),c.env)).json();
 await check("unavailable catalogue explicit not collected",async()=>{assert.equal(good.ok,false);assert.deepEqual(good.markets,[])});
 const ui=fs.readFileSync(new URL("./market-ui.js",import.meta.url),"utf8").replace(/initializeMarkets\(\);\s*$/,"");
 const ctx=vm.createContext({document:{createElement(){},createElementNS(){}},Number,Array,Math,Intl,Date,Set,show(){}});vm.runInContext(ui,ctx);
 const analyze=vm.runInContext("analysis",ctx);
 await check("RSI Wilder rising price RSI 100",async()=>{const a=analyze(Array.from({length:168},(_,i)=>100+i));assert.ok(Math.abs(a.rsi-100)<1e-9);assert.ok(Math.abs(a.sma20-257.5)<1e-6);assert.ok(Math.abs(a.sma50-242.5)<1e-6);assert.ok(Math.abs(a.ema20-257.5)<1e-5)});
 await check("flat RSI 50 and MACD zero",async()=>{const a=analyze(Array(168).fill(100));assert.equal(a.rsi,50);assert.ok(Math.abs(a.macd)<1e-9);assert.ok(Math.abs(a.macdHistogram)<1e-9)});
 await check("invalid technical series rejected",async()=>{assert.equal(analyze(Array(168).fill(0)),null)});
 await check("24h change uses t minus 24 hours",async()=>{const a=analyze(Array.from({length:168},(_,i)=>100+i));const expected=(267/243-1)*100;assert.ok(Math.abs(a.change24-expected)<1e-9)});
 console.log("SUCCEEDED",succeeded);
}
main().catch(e=>{console.error("FAIL",e);process.exitCode=1});