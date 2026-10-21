/**
 * Non-billable, quota-aware polling planner. Returns advisory scheduling
 * constraints only: it never changes Worker Cron or calls a vendor API.
 */
export const VERIFIED_DATED_FREE_BUDGETS=Object.freeze({
 NAVASAN:{calls:120,period:'MONTH',source:'https://www.navasan.tech/en/api',checked:'2026-10-15'},
 GHEYMAT_ONLINE:{calls:250,period:'DAY',source:'https://gheymat.online/price-api',checked:'2026-10-15'}
});
export function quotaBudget({calls,windowMinutes,callsPerPoll=1,reserveFraction=0.25}){
 for(const x of [calls,windowMinutes,callsPerPoll]){
  if(!Number.isSafeInteger(x)||x<=0)throw new RangeError('positive integers required');
 }
 if(!Number.isFinite(reserveFraction)||reserveFraction<0||reserveFraction>=1)
  throw new RangeError('reserveFraction must be 0..1 exclusive');
 const usable=Math.floor(calls*(1-reserveFraction));
 const allowed=Math.floor(usable/callsPerPoll);
 if(allowed<1)throw new RangeError('No quota available after reserve');
 const mathematicallyMinimalMinutes=windowMinutes*callsPerPoll/calls;
 const reservedMinimumMinutes=windowMinutes/allowed;
 const suggestedMinutes=Math.ceil(reservedMinimumMinutes);
 const scheduledCycles=Math.ceil(windowMinutes/suggestedMinutes);
 const spend=scheduledCycles*callsPerPoll;
 if(spend>usable)throw new Error('Planner exceeded reserved budget');
 return {quotaLimit:calls,availableCalls:usable,callsPerPoll,windowMinutes,
  mathematicallyMinimalMinutes,reservedMinimumMinutes,suggestedMinutes,
  plannedCalls:spend,remainingCalls:calls-spend,
  guaranteedLatencyMs:null,latencyVerified:false,advisoryOnly:true};
}
export function officialFreePlanBudget(provider,{daysInMonth=30,callsPerPoll=1,reserveFraction=.25}={}){
 const plan=VERIFIED_DATED_FREE_BUDGETS[provider];
 if(!plan)throw new RangeError('unknown provider');
 if(plan.period==='MONTH'&&![28,29,30,31].includes(daysInMonth))
  throw new RangeError('daysInMonth');
 return quotaBudget({calls:plan.calls,windowMinutes:
  plan.period==='DAY'?1440:daysInMonth*1440,callsPerPoll,reserveFraction});
}
