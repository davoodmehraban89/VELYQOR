/**
 * Deterministic, paper-only alert state machine. No broker/network dependencies.
 * Every accepted data sample is uniquely identified by source timestamp.
 * Delivery is a SEPARATE concern; state changes never send notifications.
 */
const POS=new Set(['LONG','SHORT']), PHASE=new Set(['ARMED','TRIGGERED','NOTIFIED','CLOSED']);
const TYPES=new Set(['ABOVE','BELOW','ENTRY_PCT','STOP_LOSS','TAKE_PROFIT','TRAILING_STOP']);
const positive=n=>Number.isFinite(n)&&n>0;
const when=v=>{const t=Date.parse(v);if(typeof v!=='string'||!Number.isFinite(t))throw new TypeError('timestamp');return t};
function checkLeg(rule){
 if(!rule||typeof rule!=='object'||!TYPES.has(rule.type))throw new RangeError('type');
 if(!['BUY','SELL'].includes(rule.side))throw new RangeError('side');
 if(rule.type==='TRAILING_STOP'){
  if(!POS.has(rule.position))throw new RangeError('position');
  if(!['ATR','PCT'].includes(rule.mode))throw new RangeError('mode');
  if(!positive(rule.distance))throw new RangeError('distance');
  if(rule.mode==='PCT'&&rule.distance>=100)throw new RangeError('percent range');
 }else if(!positive(rule.threshold)&&!(['STOP_LOSS','TAKE_PROFIT','ENTRY_PCT'].includes(rule.type)&&positive(rule.entry))) {
  throw new RangeError('threshold');
 }
 if(['STOP_LOSS','TAKE_PROFIT','ENTRY_PCT'].includes(rule.type)){
  if(!POS.has(rule.position)||!positive(rule.entry))throw new RangeError('entry and position');
  if(!positive(rule.threshold))throw new RangeError('threshold');
 }
 if(['STOP_LOSS','TAKE_PROFIT','TRAILING_STOP'].includes(rule.type)&&
   rule.side!==(rule.position==='LONG'?'SELL':'BUY'))throw new RangeError('exit side wrong');
}
function tickCondition(rule,price,trailStop){
 switch(rule.type){
  case 'ABOVE':return price>=rule.threshold;
  case 'BELOW':return price<=rule.threshold;
  case 'ENTRY_PCT':return rule.position==='LONG'?
     (price/rule.entry-1)*100>=rule.threshold:
     (rule.entry/price-1)*100>=rule.threshold;
  case 'STOP_LOSS':return rule.position==='LONG'?price<=rule.threshold:price>=rule.threshold;
  case 'TAKE_PROFIT':return rule.position==='LONG'?price>=rule.threshold:price<=rule.threshold;
  case 'TRAILING_STOP':return rule.position==='LONG'?price<=trailStop:price>=trailStop;
 }
}
export function initialAlertState(id) {
 if(typeof id!=='string'||!id.trim())throw new TypeError('alert id required');
 return {id,phase:'ARMED',lastTimestamp:null,consecutive:0,firstCandidateAt:null,
    highWater:null,lowWater:null,stop:null,triggeredAt:null,eventId:null,notifiedAt:null,closedAt:null,
    selectedLeg:null,cooldownUntil:null};
}
const checkRule=r=>{
 if(!r||typeof r.id!=='string'||!r.id||
    typeof r.symbol!=='string'||!r.symbol||
    typeof r.unit!=='string'||!r.unit||
    typeof r.provider!=='string'||!r.provider||
    !Array.isArray(r.legs)||!r.legs.length||r.legs.length>2)
  throw new TypeError('alert id + 1 or 2 legs');
 for(const leg of r.legs)checkLeg(leg);
 if(r.legs.length===2&&r.legs[0].type===r.legs[1].type)
  throw new RangeError('OCO legs must have distinct types');
 if(r.legs.length===2&&r.legs.some(l=>l.type==='TRAILING_STOP'&&l.mode==='PCT'))
  throw new RangeError('percentage trailing OCO needs extra explicit review');
 if(r.legs.some(l=>l.side!==r.legs[0].side))throw new RangeError('OCO same exit side required');
 if(!Number.isInteger(r.confirmSamples??1)||(r.confirmSamples??1)<1||(r.confirmSamples??1)>20)
  throw new RangeError('confirmSamples');
 if(!Number.isFinite(r.confirmMs??0)||(r.confirmMs??0)<0)throw new RangeError('confirmMs');
 if(!Number.isFinite(r.maxGapMs??600000)||(r.maxGapMs??600000)<=0)throw new RangeError('maxGapMs');
 if(!Number.isFinite(r.cooldownMs??0)||(r.cooldownMs??0)<0)throw new RangeError('cooldownMs');
};
export function stepAlert(rule,previous,quote,gate) {
 checkRule(rule);
 const state=previous??initialAlertState(rule.id);
 if(state.id!==rule.id||!PHASE.has(state.phase))throw new RangeError('corrupt state');
 if(state.phase!=='ARMED')return {state,events:[],reason:'ALREADY_TRIGGERED_OR_CLOSED'};
 if(gate?.status!=='GOOD'||gate.alertsSuspended||!gate.accepted||!quote||
    gate.accepted.symbol!==quote.symbol||gate.accepted.provider!==quote.provider||
    gate.accepted.side!==quote.side||gate.accepted.unit!==quote.unit||
    gate.accepted.price!==quote.price||gate.accepted.timestamp!==quote.timestamp)
  return {state:{...state,consecutive:0,firstCandidateAt:null},events:[],reason:'QUALITY_HOLD'};
 const t=when(quote.timestamp),last=state.lastTimestamp===null?null:when(state.lastTimestamp);
 if(last!==null&&t<=last)return {state,events:[],reason:t===last?'DUPLICATE':'OUT_OF_ORDER'};
 if(!positive(quote.price)||quote.side!==rule.legs[0].side||
    quote.symbol!==rule.symbol||quote.unit!==rule.unit||quote.provider!==rule.provider)
  return {state,events:[],reason:'QUOTE_SIDE_OR_PRICE_INVALID'};
 let high=state.highWater,low=state.lowWater,stop=state.stop;
 // Trailing state must advance on each valid observation before evaluating.
 for(const leg of rule.legs){
  if(leg.type!=='TRAILING_STOP')continue;
  const reference=leg.position==='LONG'?(high=Math.max(high??quote.price,quote.price)):
    (low=Math.min(low??quote.price,quote.price));
  if(leg.mode==='ATR'&&!positive(quote.atr))
    return {state:{...state,lastTimestamp:quote.timestamp,consecutive:0,firstCandidateAt:null},
      events:[],reason:'ATR_DATA_UNAVAILABLE'};
  const distance=leg.mode==='ATR'?leg.distance*quote.atr:reference*leg.distance/100;
  const computed=leg.position==='LONG'?reference-distance:reference+distance;
  stop=leg.position==='LONG'?Math.max(stop??computed,computed):Math.min(stop??computed,computed);
 }
 const matching=rule.legs.map((leg,i)=>({leg,i,match:tickCondition(leg,quote.price,stop)}))
   .filter(v=>v.match);
 // OCO simultaneous trigger resolves deterministically to protective stop.
 matching.sort((a,b)=>{
   const priority=leg=>(leg.type==='STOP_LOSS'||leg.type==='TRAILING_STOP'?0:1);
   return priority(a.leg)-priority(b.leg)||a.i-b.i;
 });
 const matched=matching[0];
 const gap=last===null?0:t-last;
 const carry=gap<=(rule.maxGapMs??600000)&&state.selectedLeg===matched?.i;
 const count=matched?(carry?state.consecutive+1:1):0;
 const first=matched?(carry?state.firstCandidateAt??quote.timestamp:quote.timestamp):null;
 const next={...state,lastTimestamp:quote.timestamp,highWater:high,lowWater:low,stop,
   consecutive:count,firstCandidateAt:first,selectedLeg:matched?.i??null};
 if(!matched)return{state:next,events:[],reason:'NOT_CROSSED'};
 const enoughCount=count>=(rule.confirmSamples??1);
 const enoughTime=t-when(first)>=(rule.confirmMs??0);
 if(!enoughCount||!enoughTime)return{state:next,events:[],reason:'AWAITING_CONFIRMATION'};
 const eventId=rule.id+':'+quote.timestamp+':'+matched.i;
 const triggered={...next,phase:'TRIGGERED',triggeredAt:quote.timestamp,eventId};
 return {state:triggered,events:[{
   kind:'INFORMATIONAL_THRESHOLD',id:eventId,ruleId:rule.id,
   source:quote.provider,symbol:quote.symbol,side:quote.side,price:quote.price,
   at:quote.timestamp,legIndex:matched.i,ruleType:matched.leg.type,
   labels:['اطلاعات آموزشی و غیرتوصیه‌ای'],cancelledOcoLegs:rule.legs
    .map((_,i)=>i).filter(i=>i!==matched.i)
 }],reason:'TRIGGERED'};
}
export function markNotified(rule,state,{eventId,at,deliveryId}) {
 checkRule(rule);
 if(!state||state.id!==rule.id||state.phase!=='TRIGGERED'||state.eventId!==eventId)
  throw new RangeError('Only matching, unnotified triggered event can advance');
 if(typeof deliveryId!=='string'||!deliveryId)throw new TypeError('delivery proof required');
 if(when(at)<when(state.triggeredAt))throw new RangeError('notification before trigger');
 return {...state,phase:'NOTIFIED',notifiedAt:at,deliveryId,
   cooldownUntil:new Date(when(at)+(rule.cooldownMs??0)).toISOString()};
}
export function closeAlert(state,at) {
 if(!state||state.phase!=='NOTIFIED')throw new RangeError('not notified');
 if(when(at)<when(state.notifiedAt))throw new RangeError('close before notify');
 return {...state,phase:'CLOSED',closedAt:at};
}
