/**
 * ChartNova WebSocket edge gateway (Cloudflare Durable Object design).
 * NOT wired to the live velyqor-preview Worker. Deploy only after enabling
 * Durable Objects, installing a server-side publish secret, and completing E2E tests.
 * No upstream provider is connected; this code must never emit demo prices.
 */
import {canonicalReferencePoint,canonicalSourceCandle,transportFrame,DATA_KIND} from "../../packages/market-feed/src/contracts.mjs";
import {validateSubscribeCommand} from "../../packages/market-feed/src/realtime-protocol.mjs";

const allowedOrigins=new Set(["https://app.chartnova.ir","https://chartnova.ir"]);
const json=(obj,status=200)=>Response.json(obj,{status,headers:{"cache-control":"no-store"}});
const maxBody=16_384;
function sameSecret(a,b){
  if(typeof a!=="string"||typeof b!=="string"||b.length<32||a.length!==b.length)return false;
  // Avoid direct string equality's early return. No secret is logged.
  let acc=0;for(let i=0;i<b.length;i++)acc|=a.charCodeAt(i)^b.charCodeAt(i);
  return acc===0;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/ws/market"){
      if(request.method!=="GET"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"websocket_upgrade_required"},426);
      if(!allowedOrigins.has(request.headers.get("Origin")))return json({error:"origin_forbidden"},403);
      if(!env.CHARTNOVA_REALTIME_HUB)return json({error:"gateway_not_configured"},503);
      const stub=env.CHARTNOVA_REALTIME_HUB.get(env.CHARTNOVA_REALTIME_HUB.idFromName("public-market-v1"));
      return stub.fetch(request);
    }
    if(url.pathname==="/internal/market-publish"&&request.method==="POST"){
      if(!sameSecret(request.headers.get("x-chartnova-publish-token"),env.CHARTNOVA_REALTIME_PUBLISH_TOKEN))return json({error:"unauthorized"},401);
      if(Number(request.headers.get("content-length")||0)>maxBody)return json({error:"payload_too_large"},413);
      if(!env.CHARTNOVA_REALTIME_HUB)return json({error:"gateway_not_configured"},503);
      let record;
      try{
        const text=await request.text();
        if(text.length>maxBody)throw Error("oversize");
        const item=JSON.parse(text);
        record=item?.dataKind===DATA_KIND.REFERENCE?canonicalReferencePoint(item):canonicalSourceCandle(item);
        // Never send unknown, invalid or unlicensed provider observations.
        if(record.rights!=="approved_public"||record.quality==="INVALID")return json({error:"not_licensed_for_publication"},403);
      }catch{return json({error:"invalid_market_record"},400)}
      const stub=env.CHARTNOVA_REALTIME_HUB.get(env.CHARTNOVA_REALTIME_HUB.idFromName("public-market-v1"));
      return stub.fetch(new Request("https://internal.chartnova.invalid/_publish",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(record),
      }));
    }
    return json({error:"not_found"},404);
  }
};
// Durable Object Hibernation pattern; use Worker routing above as the only public entry.
export class ChartNovaRealtimeHub {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async fetch(request){
    const pathname=new URL(request.url).pathname;
    if(pathname==="/ws/market"){
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"upgrade_required"},426);
      if(this.ctx.getWebSockets().length>=500)return json({error:"connection_limit"},503);
      const pair=new WebSocketPair();
      const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({symbols:[],timeframe:"1m"});
      return new Response(null,{status:101,webSocket:client});
    }
    if(pathname==="/_publish"&&request.method==="POST"){
      let item;
      try{
        const raw=await request.text();
        if(raw.length>maxBody)throw Error("Too large");
        item=JSON.parse(raw);
        item=item.dataKind===DATA_KIND.REFERENCE?canonicalReferencePoint(item):canonicalSourceCandle(item);
        if(item.rights!=="approved_public"||item.quality==="INVALID")return json({error:"not_licensed"},403);
      }catch{return json({error:"invalid_data"},400)}
      const channel=item.symbol+"|"+(item.timeframe??"point")+"|"+item.source;
      // Atomic sequence counters survive DO hibernation / restarts.
      const sequence=await this.ctx.storage.transaction(async(tx)=>{
        const key="sequence:"+channel;
        const current=(await tx.get(key))??0;
        const next=current+1;
        await tx.put(key,next);
        return next;
      });
      const frame=transportFrame(item,sequence,new Date().toISOString());
      let delivered=0;
      for(const client of this.ctx.getWebSockets()){
        const state=client.deserializeAttachment();
        if(!state?.symbols?.includes(item.symbol))continue;
        if(item.dataKind===DATA_KIND.CANDLE&&state.timeframe!==item.timeframe)continue;
        try{client.send(JSON.stringify(frame));delivered++}catch{}
      }
      return json({ok:true,delivered,sequence});
    }
    return json({error:"not_found"},404);
  }
  async webSocketMessage(ws,message){
    try{
      const command=validateSubscribeCommand(message);
      ws.serializeAttachment({symbols:command.symbols,timeframe:command.timeframe});
      ws.send(JSON.stringify({type:"subscribed",version:1,symbols:command.symbols,timeframe:command.timeframe,
        note:"Historical snapshots must be fetched via REST after any reconnect/gap."}));
    }catch{
      try{ws.send(JSON.stringify({type:"error",code:"invalid_subscription"}))}catch{}
    }
  }
  async webSocketClose(ws,code,reason){try{ws.close(code,reason)}catch{}}
}
