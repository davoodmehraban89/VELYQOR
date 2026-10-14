/**
 * Non-predictive paper-scenario trend telemetry; NEVER a live trade signal.
 * Consumes only the explicitly entered fictional OPEN/MARK prices.
 */
function average(items) {
  return items.reduce((total,x)=>total+x,0)/items.length;
}
export function analyzePaperTrend(position) {
  if (!position || position.kind!=='PAPER_POSITION'||!Array.isArray(position.events))
    throw new TypeError('paper position is required');
  const events=position.events.filter(e=>e.type==='OPEN'||e.type==='MARK');
  const prices=events.map(e=>Number(e.price));
  if (!prices.every(x=>Number.isFinite(x)&&x>0))
    throw new RangeError('invalid paper scenario prices');
  const values=prices.slice(-40);
  if (values.length<5) {
    return {kind:'PAPER_TREND',status:'INSUFFICIENT_SCENARIO_DATA',
      sampleCount:values.length,classification:'UNDETERMINED',
      fastSma:null,slowSma:null,momentumPercent:null,points:values};
  }
  const fast=average(values.slice(-3));
  const slow=average(values.slice(-5));
  const last=values.at(-1);
  const baseline=values.at(-5);
  const momentum=(last/baseline-1)*100;
  // Small movements around equality are neutral; no market inference.
  const diff=(fast/slow-1)*100;
  const trend=diff>0.05&&momentum>0.05?'UP':
    diff< -0.05&&momentum< -0.05?'DOWN':'SIDEWAYS';
  return {kind:'PAPER_TREND',status:'SCENARIO_ONLY',sampleCount:values.length,
    classification:trend,fastSma:fast,slowSma:slow,momentumPercent:momentum,
    points:values};
}
export function initialPaperRiskReward(position) {
  if(!position || position.kind!=='PAPER_POSITION')throw new TypeError('invalid paper position');
  const loss=Math.abs(position.entryPrice-position.initialStop);
  const gain=Math.abs(position.takeProfitPrice-position.entryPrice);
  return loss>0?gain/loss:null;
}
