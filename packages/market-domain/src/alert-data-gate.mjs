/**
 * Source-provenance and data-integrity acceptance gate for informational alerts.
 * Pure, deterministic and safe to replay. Never returns a trading instruction.
 */
const REASONS = new Set(['STALE','SPIKE_PENDING','SOURCE_DIVERGENCE','SOURCE_TIME_SKEW','SECONDARY_UNVERIFIED','RIGHTS_UNVERIFIED','SOURCE_UNAVAILABLE','INVALID','OUT_OF_ORDER','DUPLICATE','RECOVERING','CLOSED_MARKET']);
const positive = n => Number.isFinite(n) && n > 0;
const timestamp = v => {
 const n=Date.parse(v);
 if(typeof v!=='string'||!Number.isFinite(n))throw new TypeError('valid ISO timestamp required');
 return n;
};
function fresh(o,now,config) {
 const t=timestamp(o.timestamp);
 return t<=now+config.clockToleranceMs && now-t<=config.maxAgeMs;
}
export const DEFAULT_DATA_GATE = Object.freeze({
 maxAgeMs:10*60_000, clockToleranceMs:30_000, maxMovePct:3,
 maxDivergencePct:2, confirmTolerancePct:0.5, maxSourceSkewMs:60_000, recoverySamples:2
});
export function checkConfig(config) {
 const c={...DEFAULT_DATA_GATE,...config};
 for(const key of ['maxAgeMs','clockToleranceMs','maxMovePct','maxDivergencePct','confirmTolerancePct','maxSourceSkewMs'])
  if(!Number.isFinite(c[key])||c[key]<0)throw new RangeError(key+' invalid');
 if(!Number.isInteger(c.recoverySamples)||c.recoverySamples<1||c.recoverySamples>10)
  throw new RangeError('recoverySamples invalid');
 return c;
}
export function initialGateState() {
 return {lastSampleAt:null,lastAccepted:null,quarantined:null,suspended:true,recoveryCount:0};
}
export function evaluateQuoteGate(previous,observation,options={}) {
 const state=previous??initialGateState();
 const c=checkConfig(options.config);
 const now=Number(options.nowMs??Date.now());
 if(!Number.isFinite(now))throw new TypeError('nowMs invalid');
 const result=(status, next, observationAccepted=null)=>{
  if(!REASONS.has(status)&&status!=='GOOD')throw new Error('invalid status');
  return {status,alertsSuspended:status!=='GOOD',state:{...next,suspended:status!=='GOOD'},accepted:observationAccepted};
 };
 if(options.marketOpen===false)
  return result('CLOSED_MARKET',{...state,recoveryCount:0});
 if(!observation || observation.available===false)
  return result('SOURCE_UNAVAILABLE',{...state,quarantined:null,recoveryCount:0});
 const {symbol,provider,unit,side,price}=observation;
 if(!symbol||!provider||!unit||!['BUY','SELL','REFERENCE'].includes(side)||!positive(price))
  return result('INVALID',{...state,quarantined:null,recoveryCount:0});
 if(observation.permission?.publicDisplay!==true||observation.permission?.derivedAlerts!==true)
  return result('RIGHTS_UNVERIFIED',{...state,quarantined:null,recoveryCount:0});
 let sampleMs;
 try{sampleMs=timestamp(observation.timestamp)}catch{return result('INVALID',{...state,recoveryCount:0})}
 if(sampleMs>now+c.clockToleranceMs||now-sampleMs>c.maxAgeMs)
  return result('STALE',{...state,quarantined:null,recoveryCount:0});
 const lastMs=state.lastSampleAt===null?null:timestamp(state.lastSampleAt);
 if(lastMs!==null&&sampleMs<=lastMs)
  return result(sampleMs===lastMs?'DUPLICATE':'OUT_OF_ORDER',
    {...state,recoveryCount:0,quarantined:null});
 const next={...state,lastSampleAt:new Date(sampleMs).toISOString()};
 const last=state.lastAccepted;
 if(last&&(last.symbol!==symbol||last.provider!==provider||last.unit!==unit||last.side!==side))
  return result('INVALID',{...next,recoveryCount:0,quarantined:null});
 const secondary=options.secondary??null;
 if(secondary!==null){
  if(secondary.permission?.publicDisplay!==true||secondary.permission?.derivedAlerts!==true)
   return result('SECONDARY_UNVERIFIED',{...next,recoveryCount:0,quarantined:null});
  let secondaryMs;
  try{secondaryMs=timestamp(secondary.timestamp)}
  catch{return result('SECONDARY_UNVERIFIED',{...next,recoveryCount:0,quarantined:null})}
  if(secondary.symbol!==symbol||secondary.unit!==unit||secondary.side!==side||
    secondary.provider===provider||!positive(secondary.price))
   return result('SECONDARY_UNVERIFIED',{...next,recoveryCount:0,quarantined:null});
  if(secondaryMs>now+c.clockToleranceMs||now-secondaryMs>c.maxAgeMs||
     Math.abs(sampleMs-secondaryMs)>c.maxSourceSkewMs)
   return result('SOURCE_TIME_SKEW',{...next,recoveryCount:0,quarantined:null});
  const delta=Math.abs(price/secondary.price-1)*100;
  if(delta>c.maxDivergencePct)
   return result('SOURCE_DIVERGENCE',{...next,recoveryCount:0,quarantined:null});
 }
 let spike=false;
 if(last&&Math.abs(price/last.price-1)*100>c.maxMovePct){
  const pending=state.quarantined;
  const confirmingRepeat=pending&&pending.symbol===symbol&&pending.side===side&&
    Math.abs(price/pending.price-1)*100<=c.confirmTolerancePct;
  const confirmingSecondary=secondary!==null;
  if(!confirmingRepeat&&!confirmingSecondary){
   spike=true;
  }
 }
 if(spike){
  return result('SPIKE_PENDING',{...next,quarantined:{symbol,side,price,timestamp:observation.timestamp},
    recoveryCount:0});
 }
 const accepted={symbol,provider,unit,side,price,timestamp:new Date(sampleMs).toISOString()};
 const count=(state.suspended?state.recoveryCount+1:c.recoverySamples);
 const acceptedState={...next,lastAccepted:accepted,quarantined:null,recoveryCount:count};
 if(count<c.recoverySamples)return result('RECOVERING',acceptedState);
 return result('GOOD',acceptedState,accepted);
}
