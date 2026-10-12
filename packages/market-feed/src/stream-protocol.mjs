// Versioned WebSocket messages. No market fixtures or vendor-specific shapes.
const CANONICAL_SYMBOL=/^[A-Z0-9_]{3,48}$/;
const VALID_INTERVALS=new Set(["1m","5m","15m","30m","1h","4h","1d"]);
const ALLOWED_TYPES=new Set(["market.update","session.ready","stream.error","stream.heartbeat"]);
export function parseSubscriptions(raw,{maxSymbols=12}={}){
  if(!Number.isSafeInteger(maxSymbols)||maxSymbols<1||maxSymbols>100)throw Error("invalid maxSymbols");
  if(typeof raw!=="string"||raw.length<3||raw.length>600)throw Error("invalid subscription list");
  const requested=raw.split(",").map(x=>x.trim());
  if(requested.some(x=>!CANONICAL_SYMBOL.test(x))||requested.length>maxSymbols)throw Error("invalid subscription symbols");
  const symbols=[...new Set(requested)];
  if(!symbols.length||symbols.length>maxSymbols)throw Error("empty or oversized subscriptions");
  return Object.freeze(symbols);
}
export function parseClientMessage(raw){
  if(typeof raw!=="string"||raw.length>2048)throw Error("message too large");
  let msg;
  try{msg=JSON.parse(raw)}catch{throw Error("invalid JSON")}
  if(!msg||typeof msg!=="object"||Array.isArray(msg)||msg.version!==1)throw Error("unsupported protocol version");
  if(msg.type==="stream.ping")return Object.freeze({type:"stream.ping",version:1});
  if(msg.type!=="stream.subscribe")throw Error("client message not supported");
  const symbols=parseSubscriptions(Array.isArray(msg.symbols)?msg.symbols.join(","):"");
  if(msg.interval!==undefined&&!VALID_INTERVALS.has(msg.interval))throw Error("unsupported timeframe");
  return Object.freeze({type:msg.type,version:1,symbols,interval:msg.interval??null});
}
export function safeStreamEnvelope(event, allowedSymbols){
  if(!event||event.version!==1||!ALLOWED_TYPES.has(event.type))throw Error("invalid stream envelope");
  if(event.type!=="market.update")return event;
  if(!Number.isSafeInteger(event.sequence)||event.sequence<=0)throw Error("invalid stream sequence");
  if(!event.payload||typeof event.payload!=="object"||!CANONICAL_SYMBOL.test(event.payload.symbol))throw Error("invalid stream payload");
  if(!allowedSymbols.includes(event.payload.symbol))throw Error("unsubscribed symbol");
  if(!["reference_point","source_ohlc"].includes(event.payload.dataKind))throw Error("unexpected data kind");
  return event;
}
