/**
 * Offline educational ATR vs fixed-% trailing-stop comparison on authorized
 * timestamped SOURCE OHLC bars; never consumes 168 unverified price points.
 * No broker, ordering, credentials, future data, network, or execution service.
 */
const pos=x=>Number.isFinite(x)&&x>0;
export function validateBacktestBars(bars,{permission}={}){
 if(!permission||permission.historicalStorage!==true||permission.derivedAnalysis!==true)
  throw new Error('UNLICENSED_HISTORICAL_DATA');
 if(!Array.isArray(bars)||bars.length<4)throw new RangeError('At least 4 OHLC bars required');
 let previous=-Infinity;
 return bars.map((b,i)=>{
  if(!b||typeof b.timestamp!=='string'||!Number.isFinite(Date.parse(b.timestamp))||
    Date.parse(b.timestamp)<=previous)throw new RangeError('OHLC chronology');
  if(!['GOOD'].includes(b.quality)||b.origin!=='PROVIDER_OHLC')throw new RangeError('Unverified OHLC is prohibited');
  for(const k of ['open','high','low','close'])if(!pos(b[k]))throw new RangeError(k);
  if(b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.low>b.high)
   throw new RangeError('OHLC inconsistent');
  if(typeof b.provider!=='string'||!b.provider.trim()||
     typeof b.symbol!=='string'||!b.symbol.trim()||
     typeof b.unit!=='string'||!b.unit||!['BUY','SELL','REFERENCE'].includes(b.side))
   throw new RangeError('OHLC source identity, side or unit');
  if(i&& (bars[i-1].unit!==b.unit||bars[i-1].side!==b.side||
      bars[i-1].provider!==b.provider||bars[i-1].symbol!==b.symbol))
   throw new RangeError('Changing OHLC provider/symbol/units/side');
  previous=Date.parse(b.timestamp);
  return {...b};
 });
}
export function trueRanges(bars) {
 return bars.map((b,i)=>i===0?b.high-b.low:Math.max(
  b.high-b.low,Math.abs(b.high-bars[i-1].close),Math.abs(b.low-bars[i-1].close)
 ));
}
export function atrWilder(bars,period) {
 if(!Number.isInteger(period)||period<2||bars.length<=period)throw new RangeError('ATR period');
 const tr=trueRanges(bars),out=Array(bars.length).fill(null);
 let sum=0;for(let i=0;i<period;i++)sum+=tr[i];
 out[period-1]=sum/period;
 for(let i=period;i<bars.length;i++)out[i]=(out[i-1]*(period-1)+tr[i])/period;
 return out;
}
export function backtestTrailing({
 bars,permission,position='LONG',atrPeriod=3,atrMultiplier=2,fixedPct=3,entryIndex=null
}={}){
 const data=validateBacktestBars(bars,{permission});
 if(!['LONG','SHORT'].includes(position)||!pos(atrMultiplier)||!pos(fixedPct)||fixedPct>=100)
  throw new RangeError('test configuration');
 // Long exit must be priced on sell side; short on buy side.
 if(data[0].side!==(position==='LONG'?'SELL':'BUY'))
  throw new RangeError('EXIT_QUOTE_SIDE_UNVERIFIED');
 const series=atrWilder(data,atrPeriod);
 const entryAt=entryIndex??atrPeriod-1;
 if(!Number.isInteger(entryAt)||entryAt<atrPeriod-1||entryAt>=data.length-1)
  throw new RangeError('entryIndex');
 const entryPrice=data[entryAt].close;
 function sim(mode){
  let peak=entryPrice,low=entryPrice,stop=mode==='ATR'?
    (position==='LONG'?entryPrice-atrMultiplier*series[entryAt]:entryPrice+atrMultiplier*series[entryAt]):
    (position==='LONG'?entryPrice*(1-fixedPct/100):entryPrice*(1+fixedPct/100));
  const initialStop=stop;
  let exit=null;
  // Stop from CLOSED previous candle: check this bar first, update trailing after its close,
  // preventing intrabar lookahead/high-low sequencing inventions.
  for(let i=entryAt+1;i<data.length;i++){
   const b=data[i];
   const hit=position==='LONG'?b.low<=stop:b.high>=stop;
   if(hit){
    const openGap=position==='LONG'?b.open<stop:b.open>stop;
    const level=openGap?b.open:stop;
    exit={index:i,at:b.timestamp,stopLevel:stop,
      referenceExit:level,gapAtOpen:openGap,executionPriceGuaranteed:false};
    break;
   }
   peak=Math.max(peak,b.high);low=Math.min(low,b.low);
   const distance=mode==='ATR'?series[i]*atrMultiplier:null;
   const candidate=position==='LONG'?(mode==='ATR'?peak-distance:peak*(1-fixedPct/100)):
     (mode==='ATR'?low+distance:low*(1+fixedPct/100));
   stop=position==='LONG'?Math.max(stop,candidate):Math.min(stop,candidate);
  }
  return {mode,entryPrice,entryAt:data[entryAt].timestamp,initialStop,
   endStop:stop,exit,
   referenceReturnPct:exit?(position==='LONG'?
      (exit.referenceExit/entryPrice-1)*100:(entryPrice/exit.referenceExit-1)*100):null,
   advisory:false,executionPriceGuaranteed:false};
 }
 return {label:'اطلاعات آموزشی و غیرتوصیه‌ای',paperOnly:true,
  sourceDataKind:'LICENSED_PROVIDER_OHLC',provider:data[0].provider,symbol:data[0].symbol,unit:data[0].unit,side:data[0].side,
  position,barCount:data.length,atrPeriod,atrMultiplier,fixedPct,
  fixedPercent:sim('PCT'),atr:sim('ATR'),
  caveat:'Hourly/intrabar ambiguity, commissions, spread, market impact and source outage are not fully simulated. This is not a trading recommendation.'};
}
