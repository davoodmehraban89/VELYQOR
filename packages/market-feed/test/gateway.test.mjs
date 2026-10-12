import test from "node:test";
import assert from "node:assert/strict";
import {routeStreamRequest} from "../../../deploy/chartnova/market-stream-worker.mjs";
const ORIGIN="https://stream.chartnova.test";
const TOKEN="t".repeat(64); // test fixture, never a live credential
const symbol="BTC_USD";
const base={
  symbol,source:"test_provider",unit:"USD_PER_BTC",dataKind:"reference_point",price:"100",
  sourceTimestamp:"2026-09-01T10:00:00Z",receivedAt:"2026-09-01T10:00:01Z",
  licenseEvidence:"test-evidence-ref",rights:"approved_public",quality:"GOOD",
};
function env(handler){
 return {
  STREAM_INGEST_TOKEN:TOKEN,
  STREAM_SYMBOL_ALLOWLIST:symbol,
  STREAM_ROOMS:{
   idFromName:name=>name,
   get:id=>({fetch:handler??(async()=>Response.json({ok:true,room:id}))}),
  },
 };
}
const request=(path,opts)=>new Request(ORIGIN+path,opts);
test("gateway never accepts unauthenticated direct publish",async()=>{
 const result=await routeStreamRequest(request("/internal/market-update",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(base)}),env());
 assert.equal(result.status,401);
});
test("wrong rights and invalid payload rejected before Durable Object delivery",async()=>{
 let calls=0;const e=env(async()=>{calls++;return Response.json({ok:true})});
 const unlicensed=await routeStreamRequest(request("/internal/market-update",{method:"POST",
  headers:{authorization:"Bearer "+TOKEN,"content-type":"application/json"},
  body:JSON.stringify({...base,rights:"research_only"})}),e);
 assert.equal(unlicensed.status,403);assert.equal(calls,0);
 const invalid=await routeStreamRequest(request("/internal/market-update",{method:"POST",
  headers:{authorization:"Bearer "+TOKEN,"content-type":"application/json"},
  body:JSON.stringify({...base,dataKind:"invalid"})}),e);
 assert.equal(invalid.status,422);assert.equal(calls,0);
});
test("approved private publisher forwards server-only payload to exactly one symbol hub",async()=>{
 let target=null,authorization=null,safeBody=null;
 const e=env(async request=>{
  target=new URL(request.url).pathname;
  authorization=request.headers.get("x-hub-key");
  safeBody=await request.json();
  return Response.json({ok:true,sequence:1,delivered:0});
 });
 const response=await routeStreamRequest(request("/internal/market-update",{method:"POST",
  headers:{authorization:"Bearer "+TOKEN,"content-type":"application/json"},
  body:JSON.stringify(base)}),e);
 assert.equal(response.status,200);
 assert.equal(target,"/broadcast");assert.equal(authorization,TOKEN);
 assert.equal(safeBody.symbol,symbol);
 assert.equal(safeBody.price,"100");
});
test("public WebSocket requires upgrade and allowlisted subscription",async()=>{
 const a=await routeStreamRequest(request("/stream?symbol=BTC_USD"),env());
 assert.equal(a.status,426);
 const b=await routeStreamRequest(request("/stream?symbol=BAD_NAME",{headers:{upgrade:"websocket"}}),env());
 assert.equal(b.status,404);
 const c=await routeStreamRequest(request("/stream?symbol=BTC_USD&symbol=BTC_USD",{headers:{upgrade:"websocket"}}),env());
 assert.equal(c.status,400);
});
test("missing Durable Object binding is safely unavailable",async()=>{
 const e=env();delete e.STREAM_ROOMS;
 const r=await routeStreamRequest(request("/stream?symbol=BTC_USD",{headers:{upgrade:"websocket"}}),e);
 assert.equal(r.status,503);
});
