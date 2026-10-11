// Separate, UNDEPLOYED Cloudflare Worker + Durable Object WebSocket gateway.
// Hibernation keeps inbound subscriptions alive without a permanent Worker process.
// To activate: configure STREAM_ROOMS DO binding, STREAM_INGEST_TOKEN secret,
// route /stream and /internal/market-update, and review provider/public licensing.
import {
  canonicalReferencePoint, canonicalSourceCandle, mayPublish, transportFrame,
} from "../../packages/market-feed/src/contracts.mjs";
import {parseSubscriptions,parseClientMessage} from "../../packages/market-feed/src/stream-protocol.mjs";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond=(data,status=200)=>Response.json(data,{status,headers:JSON_HEADERS});
const symbolValid=s=>typeof s==="string"&&/^[A-Z0-9_]{3,48}$/.test(s);
function equalSecret(a,b){
  if(typeof a!=="string"||typeof b!=="string"||b.length<32||a.length!==b.length)return false;
  let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
function allowedSymbol(env,symbol){
  if(!symbolValid(symbol))return false;
  const approved=typeof env.STREAM_SYMBOL_ALLOWLIST==="string"?env.STREAM_SYMBOL_ALLOWLIST.split(",").map(x=>x.trim()):[];
  return approved.includes(symbol);
}
function room(env,symbol){
  if(!env.STREAM_ROOMS||typeof env.STREAM_ROOMS.idFromName!=="function")return null;
  return env.STREAM_ROOMS.get(env.STREAM_ROOMS.idFromName("symbol:"+symbol));
}
function parseMarketRecord(data){
  return data?.dataKind==="source_ohlc"?canonicalSourceCandle(data):
         data?.dataKind==="reference_point"?canonicalReferencePoint(data):
         (()=>{throw Error("unsupported record kind")})();
}
export async function routeStreamRequest(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health")return respond({ok:true,service:"chartnova-market-stream",livePublisherConfigured:!!(env.STREAM_INGEST_TOKEN&&env.STREAM_ROOMS),deployedPublisherVerified:false});
  if(url.pathname==="/stream"){
    if(request.method!=="GET")return respond({ok:false,error:"method_not_allowed"},405);
    if((request.headers.get("Upgrade")||"").toLowerCase()!=="websocket")return respond({ok:false,error:"websocket_upgrade_required"},426);
    if([...url.searchParams.keys()].some(k=>k!=="symbol"||url.searchParams.getAll(k).length!==1))return respond({ok:false,error:"invalid_query"},400);
    const symbol=url.searchParams.get("symbol");
    if(!allowedSymbol(env,symbol))return respond({ok:false,error:"symbol_unavailable"},404);
    const target=room(env,symbol);if(!target)return respond({ok:false,error:"stream_not_configured"},503);
    const forward=new URL("/connect",request.url);forward.searchParams.set("symbol",symbol);
    return target.fetch(new Request(forward,request));
  }
  if(url.pathname==="/internal/market-update"){
    if(request.method!=="POST")return respond({ok:false,error:"method_not_allowed"},405);
    const bearer=request.headers.get("authorization")||"";
    if(!equalSecret(bearer.startsWith("Bearer ")?bearer.slice(7):"",env.STREAM_INGEST_TOKEN))return respond({ok:false,error:"unauthorized"},401);
    const size=Number(request.headers.get("content-length")||0);
    if(size>8192)return respond({ok:false,error:"payload_too_large"},413);
    let item;try{item=await request.json()}catch{return respond({ok:false,error:"invalid_json"},400)}
    let record;
    try{record=parseMarketRecord(item)}catch{return respond({ok:false,error:"invalid_market_record"},422)}
    if(!allowedSymbol(env,record.symbol))return respond({ok:false,error:"symbol_unavailable"},404);
    if(!mayPublish(record))return respond({ok:false,error:"source_not_approved_for_public_stream"},403);
    const target=room(env,record.symbol);if(!target)return respond({ok:false,error:"stream_not_configured"},503);
    return target.fetch(new Request(new URL("/broadcast?symbol="+encodeURIComponent(record.symbol),request.url),{
      method:"POST",
      headers:{"content-type":"application/json","x-hub-key":env.STREAM_INGEST_TOKEN},
      body:JSON.stringify(record),
    }));
  }
  return respond({ok:false,error:"not_found"},404);
}
export default {fetch:routeStreamRequest};

export class SymbolStreamRoom {
  constructor(state,env){this.state=state;this.env=env}
  async fetch(request){
    const url=new URL(request.url);
    const symbol=url.searchParams.get("symbol");
    if(!symbolValid(symbol))return respond({ok:false,error:"invalid_symbol"},400);
    if(url.pathname==="/connect"){
      if((request.headers.get("Upgrade")||"").toLowerCase()!=="websocket")return respond({ok:false,error:"upgrade_required"},426);
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.state.acceptWebSocket(server,[symbol]);
      server.serializeAttachment({symbol,version:1});
      return new Response(null,{status:101,webSocket:client});
    }
    if(url.pathname==="/broadcast"&&request.method==="POST"){
      if(!equalSecret(request.headers.get("x-hub-key"),this.env.STREAM_INGEST_TOKEN))return respond({ok:false,error:"unauthorized"},401);
      let record;
      try{record=parseMarketRecord(await request.json())}catch{return respond({ok:false,error:"invalid_market_record"},422)}
      if(record.symbol!==symbol||!mayPublish(record))return respond({ok:false,error:"wrong_symbol_or_unlicensed"},403);
      const seq=await this.state.storage.transaction(async tx=>{
        const previous=await tx.get("nextSequence")??0;
        const next=previous+1;
        if(!Number.isSafeInteger(next))throw Error("stream sequence overflow");
        await tx.put("nextSequence",next);return next;
      });
      const envelope=transportFrame(record,seq,new Date().toISOString());
      const data=JSON.stringify(envelope);
      let delivered=0;
      for(const socket of this.state.getWebSockets(symbol)){
        if(socket.readyState!==1)continue;
        try{socket.send(data);delivered++}catch{try{socket.close(1011,"send error")}catch{}}
      }
      return respond({ok:true,symbol,sequence:seq,delivered});
    }
    return respond({ok:false,error:"not_found"},404);
  }
  webSocketMessage(ws,message){
    const attachment=ws.deserializeAttachment();
    if(!attachment||!symbolValid(attachment.symbol)){ws.close(1008,"invalid subscription");return}
    let input;try{input=parseClientMessage(message)}catch{ws.close(1008,"invalid protocol");return}
    if(input.type==="stream.ping"){
      ws.send(JSON.stringify({type:"stream.heartbeat",version:1,serverTime:new Date().toISOString()}));return;
    }
    if(input.type==="stream.subscribe"&&input.symbols.length===1&&input.symbols[0]===attachment.symbol){
      ws.send(JSON.stringify({type:"session.ready",version:1,symbol:attachment.symbol}));return;
    }
    ws.close(1008,"subscription mismatch");
  }
  webSocketClose(ws,code,reason){try{ws.close(code||1000,reason||"closed")}catch{}}
  webSocketError(ws){try{ws.close(1011,"internal error")}catch{}}
}
