#!/usr/bin/env node
// Local-only WebSocket smoke test. ALL events are FICTITIOUS TEST FIXTURES.
// DO NOT route this script to a public host or any production database.
import assert from "node:assert/strict";
const base=process.env.CHARTNOVA_LOCAL_TEST_ORIGIN??"http://127.0.0.1:8789";
const url=new URL(base);
if(!["127.0.0.1","localhost"].includes(url.hostname)||url.protocol!=="http:")
 throw Error("Test must target an HTTP localhost Worker only");
if(typeof WebSocket!=="function")throw Error("Node WebSocket global required (Node 22+)");
const LOCAL_TOKEN="CHARTNOVA_LOCAL_ONLY_FAKE_PUBLISH_TOKEN_12345678901234567890";
const SYMBOL="EUR_USD_ECB";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const timeout=AbortSignal.timeout(16000);
async function waitForType(socket,type){
 return await new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(Error("Timeout waiting for "+type))};
  const cleanup=()=>{socket.removeEventListener("message",onmessage);socket.removeEventListener("error",onerror);timeout.removeEventListener("abort",abort)};
  const onerror=()=>{cleanup();reject(Error("WebSocket test socket error"))};
  const onmessage=(event)=>{
   let data;try{data=JSON.parse(event.data)}catch{return}
   if(data.type!==type)return;
   cleanup();resolve(data);
  };
  socket.addEventListener("message",onmessage);
  socket.addEventListener("error",onerror);
  timeout.addEventListener("abort",abort,{once:true});
 });
}
const wsUrl=new URL("/stream?symbol="+SYMBOL,url);
wsUrl.protocol="ws:";
const ws=new WebSocket(wsUrl);
try{
 await new Promise((resolve,reject)=>{
  const abort=()=>reject(Error("Local Worker WebSocket open timeout"));
  ws.addEventListener("open",resolve,{once:true});
  ws.addEventListener("error",()=>reject(Error("Local Worker socket open failed")),{once:true});
  timeout.addEventListener("abort",abort,{once:true});
 });
 const readyPromise=waitForType(ws,"session.ready");
 ws.send(JSON.stringify({version:1,type:"stream.subscribe",symbols:[SYMBOL]}));
 const ready=await readyPromise;
 assert.equal(ready.symbol,SYMBOL);
 const updatePromise=waitForType(ws,"market.update");
 const fake={
  dataKind:"reference_point",symbol:SYMBOL,source:"test_local_only",unit:"USD_PER_EUR",
  price:"1.2345",sourceTimestamp:"2026-10-09T12:00:00Z",receivedAt:"2026-10-09T12:00:01Z",
  quality:"GOOD",licenseEvidence:"test-only-do-not-publish",rights:"approved_public"
 };
 const response=await fetch(new URL("/internal/market-update",url),{
  method:"POST",
  headers:{"content-type":"application/json","authorization":"Bearer "+LOCAL_TOKEN},
  body:JSON.stringify(fake),signal:timeout
 });
 assert.equal(response.status,200,"Local publisher should accept test-only credentials");
 const publish=await response.json();
 assert.equal(publish.ok,true);
 assert.equal(publish.delivered,1);
 const frame=await updatePromise;
 assert.equal(frame.version,1);
 assert.equal(frame.payload.symbol,SYMBOL);
 assert.equal(frame.payload.dataKind,"reference_point");
 assert.equal(frame.payload.price,"1.2345");
 assert(!JSON.stringify(frame).includes(LOCAL_TOKEN));
 assert(!JSON.stringify(frame).includes("test-only-do-not-publish"));
 console.log(JSON.stringify({ok:true,environment:"localhost_only",fixture:"synthetic_test_event_not_persisted",symbol:SYMBOL,sequence:frame.sequence,delivered:publish.delivered}));
}finally{
 ws.close();
 await sleep(100);
}
