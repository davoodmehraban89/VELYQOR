/**
 * Future-paper-feed boundary only: does NOT contact a provider or execute orders.
 * An operator must separately verify authenticity, entitlement, signature, and transport.
 */
const timestamp=(s,name)=>{
  if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(s)||
      !Number.isFinite(Date.parse(s)))throw new TypeError(name+' needs ISO timezone');
  return Date.parse(s);
};
const goodPrice=(value,name)=>{
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)throw new TypeError(name+' must be positive and finite');
  return n;
};
export function validatePaperQuote(quote,{
  symbol, side, now, maxAgeMs=15000, lastSequence=0,
  approvedSources=[]
}={}){
  if(!quote||typeof quote!=='object'||Array.isArray(quote))
    throw new TypeError('invalid quote');
  if(!/^[A-Z0-9_]{3,48}$/.test(symbol??'')||quote.symbol!==symbol)
    throw new TypeError('symbol mismatch');
  if(side!=='LONG'&&side!=='SHORT')throw new TypeError('unsupported side');
  if(!Array.isArray(approvedSources)||!approvedSources.includes(quote.source)||
      !/^[a-z][a-z0-9_]{2,48}$/.test(quote.source??''))
    throw new TypeError('source not approved for paper quotes');
  if(quote.usage!=='PAPER_ONLY_BID_ASK'||quote.entitlement!=='reviewed_simulation_display'||
      quote.dataKind!=='bid_ask_quote')
    throw new TypeError('quote type/usage not authorized');
  if(quote.quality!=='GOOD'||quote.isMarketOpen!==true)
    throw new TypeError('quote not healthy or market not open');
  if(typeof quote.unit!=='string'||!/^[A-Z0-9_]{3,40}$/.test(quote.unit))
    throw new TypeError('missing canonical quote unit');
  if(!Number.isSafeInteger(quote.sequence)||quote.sequence<=lastSequence)
    throw new RangeError('replayed or invalid quote sequence');
  if(!Number.isInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>60000)
    throw new RangeError('unsupported freshness tolerance');
  const receivedAt=timestamp(quote.receivedAt,'receivedAt');
  const sourceAt=timestamp(quote.sourceTimestamp,'sourceTimestamp');
  const currentAt=timestamp(now,'now');
  if(sourceAt>receivedAt+1000||receivedAt>currentAt+1000||
      sourceAt>currentAt+1000||currentAt-receivedAt>maxAgeMs||
      currentAt-sourceAt>maxAgeMs)
    throw new RangeError('stale or future quote');
  const bid=goodPrice(quote.bid,'bid'),ask=goodPrice(quote.ask,'ask');
  if(bid>ask)throw new RangeError('crossed bid/ask quote');
  if((ask-bid)/ask>0.05)throw new RangeError('spread greater than 5% safety cap');
  return Object.freeze({
    symbol,source:quote.source,unit:quote.unit,sequence:quote.sequence,
    // LONG exits against bid, SHORT exits against ask; NOT a guaranteed fill.
    hypotheticalExitMark:side==='LONG'?bid:ask,
    bid,ask,sourceTimestamp:new Date(sourceAt).toISOString(),
    receivedAt:new Date(receivedAt).toISOString(),kind:'PAPER_QUOTE_ELIGIBLE'
  });
}
