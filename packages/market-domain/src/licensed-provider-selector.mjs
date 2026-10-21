/**
 * Provider-neutral cross-check and failover for information-only observations.
 * Explicit entitlement prevents accidentally republishing unlicensed data.
 */
const validPrice=n=>Number.isFinite(n)&&n>0;
const timestamp=v=>{
 if(typeof v!=='string')return null;const ms=Date.parse(v);
 return Number.isFinite(ms)?ms:null;
};
function eligible(q,{now,maxAgeMs}) {
 if(!q||q.permission?.publicDisplay!==true||q.permission?.derivedAlerts!==true)
  return {valid:false,reason:'RIGHTS_UNVERIFIED'};
 if(typeof q.provider!=='string'||!q.provider||typeof q.symbol!=='string'||!q.symbol||
    typeof q.unit!=='string'||!q.unit||!['BUY','SELL','REFERENCE'].includes(q.side)||
    !validPrice(q.price)||timestamp(q.timestamp)===null)
  return {valid:false,reason:'MALFORMED'};
 const age=now-timestamp(q.timestamp);
 if(age<0||age>maxAgeMs)return {valid:false,reason:'STALE'};
 return {valid:true,reason:'GOOD'};
}
export function inspectTwoSources(primary,secondary,{
 nowMs=Date.now(),maxAgeMs=600000,maxDivergencePct=2,maxClockSkewMs=300000
}={}){
 if(!Number.isFinite(nowMs)||!Number.isFinite(maxAgeMs)||maxAgeMs<0||
    !Number.isFinite(maxDivergencePct)||maxDivergencePct<0||
    !Number.isFinite(maxClockSkewMs)||maxClockSkewMs<0)throw new RangeError('invalid comparison configuration');
 const p=eligible(primary,{now:nowMs,maxAgeMs});
 const s=eligible(secondary,{now:nowMs,maxAgeMs});
 const blocked=(status)=>({status,alertsSuspended:true,observation:null,confirmation:'NONE'});
 if(!p.valid&&!s.valid)return blocked('BOTH_UNAVAILABLE');
 if(p.valid&&!s.valid) return{
   status:'SINGLE_SOURCE_ONLY',alertsSuspended:false,observation:{...primary},
   confirmation:'ONE_LICENSED_SOURCE_NO_CROSSCHECK'
 };
 if(!p.valid&&s.valid) return{
   status:'FALLBACK_SINGLE_SOURCE',alertsSuspended:false,observation:{...secondary},
   confirmation:'ONE_LICENSED_SOURCE_NO_CROSSCHECK'
 };
 if(primary.provider===secondary.provider||primary.symbol!==secondary.symbol||
    primary.side!==secondary.side||primary.unit!==secondary.unit)
  return blocked('INCOMPATIBLE_SOURCES');
 if(Math.abs(timestamp(primary.timestamp)-timestamp(secondary.timestamp))>maxClockSkewMs)
  return blocked('SOURCE_TIME_SKEW');
 const difference=Math.abs(primary.price/secondary.price-1)*100;
 if(difference>maxDivergencePct)return{
  ...blocked('SOURCE_DIVERGENCE'),divergencePct:difference
 };
 return {status:'CROSSCHECK_PASSED',alertsSuspended:false,
  observation:{...primary},secondaryProvider:secondary.provider,confirmation:'TWO_MATCHING_SOURCES',
  divergencePct:difference
 };
}
