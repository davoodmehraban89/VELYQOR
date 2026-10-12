import test from "node:test";
import assert from "node:assert/strict";
import {SymbolStreamRoom} from "../../../deploy/chartnova/market-stream-worker.mjs";
// Fake sockets and prices are test fixtures only; no market data is published.
const TOKEN="t".repeat(64);
function socket(bufferedAmount=0){
 const log={sent:[],closed:[]};
 return {readyState:1,bufferedAmount,log,
  send:data=>log.sent.push(JSON.parse(data)),
  close:(code,reason)=>log.closed.push({code,reason}),
  deserializeAttachment:()=>({symbol:"BTC_USD",version:1}),
 };
}
function makeRoom(sockets=[]){
 const store=new Map(),state={
  storage:{transaction:async callback=>callback({
   get:async k=>store.get(k),
   put:async(k,v)=>{store.set(k,v)}
  })},
  getWebSockets:()=>sockets,
 };
 return {room:new SymbolStreamRoom(state,{STREAM_INGEST_TOKEN:TOKEN}),store};
}
const payload={
 source:"fixture_provider",symbol:"BTC_USD",unit:"USD_PER_BTC",
 dataKind:"reference_point",price:"100",
 sourceTimestamp:"2026-10-09T10:00:00Z",receivedAt:"2026-10-09T10:00:01Z",
 quality:"GOOD",licenseEvidence:"unit-test-license-ref",rights:"approved_public"
};
const makeRequest=(body,token=TOKEN)=>new Request("https://internal.invalid/broadcast?symbol=BTC_USD",{
 method:"POST",headers:{"x-hub-key":token,"content-type":"application/json"},
 body:JSON.stringify(body),
});
test("Durable Object persists monotonic event sequence without inserting market data",async()=>{
 const good=socket(),room=makeRoom([good]);
 const r1=await room.room.fetch(makeRequest(payload));
 const r2=await room.room.fetch(makeRequest(payload));
 assert.equal(r1.status,200);assert.equal(r2.status,200);
 assert.deepEqual(good.log.sent.map(x=>x.sequence),[1,2]);
 assert.equal(await room.store.get("nextSequence"),2);
 assert.equal(good.log.sent[0].payload.symbol,"BTC_USD");
 assert.equal(JSON.stringify(good.log.sent).includes("unit-test-license-ref"),false);
});
test("slow consumers are disconnected without blocking healthy sockets",async()=>{
 const slow=socket(1_048_577),good=socket(0);
 const {room}=makeRoom([slow,good]);
 const response=await room.fetch(makeRequest(payload));
 assert.equal(response.status,200);
 assert.equal((await response.json()).delivered,1);
 assert.equal(slow.log.sent.length,0);assert.equal(slow.log.closed[0].code,1013);
 assert.equal(good.log.sent.length,1);
});
test("unauthorized publishers and cross-symbol events are rejected without increment",async()=>{
 const {room,store}=makeRoom([socket()]);
 const unauthorized=await room.fetch(makeRequest(payload,"BAD_TOKEN"));
 assert.equal(unauthorized.status,401);
 const mismatched=await room.fetch(makeRequest({...payload,symbol:"ETH_USD"}));
 assert.equal(mismatched.status,403);
 assert.equal(store.has("nextSequence"),false);
});
test("hibernated socket only accepts its own symbol and compliant protocol",()=>{
 const {room}=makeRoom([]);
 const valid=socket();room.webSocketMessage(valid,JSON.stringify({type:"stream.subscribe",version:1,symbols:["BTC_USD"]}));
 assert.equal(valid.log.sent.at(-1).type,"session.ready");
 const bad=socket();room.webSocketMessage(bad,JSON.stringify({type:"stream.subscribe",version:1,symbols:["ETH_USD"]}));
 assert.equal(bad.log.closed[0].code,1008);
});
