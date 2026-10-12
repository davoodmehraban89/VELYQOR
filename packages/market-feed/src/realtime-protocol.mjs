import {DATA_KIND,TIMEFRAMES,transportFrame} from "./contracts.mjs";
const sym=/^[A-Z0-9_]{3,48}$/;
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
export function validateSubscribeCommand(message){
  assert(typeof message==="string"&&message.length<=512,"Invalid WS frame size");
  let body;try{body=JSON.parse(message)}catch{throw Error("Invalid WS JSON")}
  assert(body&&body.type==="subscribe"&&body.version===1,"Unsupported WS command");
  assert(Array.isArray(body.symbols)&&body.symbols.length>=1&&body.symbols.length<=12,"Subscriptions must contain 1–12 symbols");
  assert(body.symbols.every(s=>typeof s==="string"&&sym.test(s)),"Invalid symbol");
  assert(new Set(body.symbols).size===body.symbols.length,"Duplicate subscription symbol");
  assert(body.timeframe===undefined||TIMEFRAMES.includes(body.timeframe),"Invalid timeframe");
  assert(Object.keys(body).every(k=>["type","version","symbols","timeframe"].includes(k)),"Unknown WS subscription property");
  return {type:"subscribe",version:1,symbols:body.symbols,timeframe:body.timeframe??"1m"};
}
export function validateRealtimeEvent(frame){
  assert(frame&&frame.type==="market.update"&&frame.version===1,"Invalid real-time event");
  assert(Number.isSafeInteger(frame.sequence)&&frame.sequence>0,"Missing sequence");
  const item=frame.payload;
  assert(item&&(item.dataKind===DATA_KIND.CANDLE||item.dataKind===DATA_KIND.REFERENCE),"Unknown event dataKind");
  assert(typeof item.symbol==="string"&&sym.test(item.symbol),"Bad symbol");
  assert(typeof item.unit==="string"&&item.unit.length>0,"Missing price unit");
  assert(typeof item.source==="string"&&item.source.length>0,"Missing provider source");
  assert(Number.isFinite(Date.parse(item.sourceTimestamp)),"Missing provider timestamp");
  assert(Number.isFinite(Date.parse(frame.publishedAt)),"Missing event timestamp");
  assert(["GOOD","DEGRADED","STALE"].includes(item.quality),"Invalid/unknown quality");
  if(item.dataKind===DATA_KIND.CANDLE){
    assert(TIMEFRAMES.includes(item.timeframe),"Invalid candle timeframe");
    assert(Date.parse(item.openTime)<Date.parse(item.closeTime),"Invalid candle times");
    const [o,h,l,c]=["open","high","low","close"].map(k=>Number(item[k]));
    assert([o,h,l,c].every(n=>Number.isFinite(n)&&n>0)&&l<=o&&o<=h&&l<=c&&c<=h,"Invalid OHLC event");
  } else {
    assert(Number.isFinite(Number(item.price))&&Number(item.price)>0,"Invalid reference point");
    assert(item.open===undefined&&item.close===undefined,"Cannot spoof OHLC from reference point");
  }
  return frame;
}
export function createRealtimeSequenceGuard(){
  const last=new Map();
  return {
    consume(frame){
      const f=validateRealtimeEvent(frame);
      const channel=f.payload.symbol+"|"+(f.payload.timeframe??"point")+"|"+f.payload.source;
      const previous=last.get(channel)??0;
      if(f.sequence<=previous)return {accepted:false,recover:false,reason:"duplicate_or_out_of_order"};
      last.set(channel,f.sequence);
      return {accepted:true,recover:previous!==0&&f.sequence!==previous+1,reason:previous!==0&&f.sequence!==previous+1?"sequence_gap":"ok"};
    },
    reset(){last.clear()}
  };
}
export {transportFrame};
