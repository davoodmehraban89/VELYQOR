import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePaperQuote} from '../src/paper-quote-guard.mjs';

const NOW='2026-10-14T20:00:00Z';
const q=()=>({
 symbol:'XAU_USD',source:'licensed_paper_feed',unit:'USD_PER_TROY_OUNCE',
 dataKind:'bid_ask_quote',usage:'PAPER_ONLY_BID_ASK',entitlement:'reviewed_simulation_display',
 quality:'GOOD',isMarketOpen:true,sequence:2,bid:'100',ask:'100.2',
 sourceTimestamp:'2026-10-14T19:59:55Z',receivedAt:'2026-10-14T19:59:57Z'
});
const opts=(side='LONG')=>({symbol:'XAU_USD',side,now:NOW,lastSequence:1,approvedSources:['licensed_paper_feed']});
test('LONG uses bid as conservative hypothetical exit mark',()=>{
 const out=validatePaperQuote(q(),opts());
 assert.equal(out.hypotheticalExitMark,100);
 assert.equal(out.kind,'PAPER_QUOTE_ELIGIBLE');
});
test('SHORT uses ask as conservative hypothetical exit mark',()=>{
 assert.equal(validatePaperQuote(q(),opts('SHORT')).hypotheticalExitMark,100.2);
});
test('rejects ECB reference points and unapproved sources',()=>{
 let x=q();x.dataKind='daily_reference_point_not_ohlc';
 assert.throws(()=>validatePaperQuote(x,opts()),/type\/usage/);
 x=q();x.source='ecb_exr';
 assert.throws(()=>validatePaperQuote(x,opts()),/source not approved/);
});
test('rejects stale source and stale receive timestamps',()=>{
 let x=q();x.sourceTimestamp='2026-10-14T19:00:00Z';
 assert.throws(()=>validatePaperQuote(x,opts()),/stale/);
 x=q();x.receivedAt='2026-10-14T19:00:00Z';
 assert.throws(()=>validatePaperQuote(x,opts()),/stale/);
});
test('rejects replay, missing sequence, future timestamp',()=>{
 let x=q();x.sequence=1;
 assert.throws(()=>validatePaperQuote(x,opts()),/replayed/);
 x=q();x.sequence=1.1;
 assert.throws(()=>validatePaperQuote(x,opts()),/replayed/);
 x=q();x.receivedAt='2026-10-14T20:03:00Z';
 assert.throws(()=>validatePaperQuote(x,opts()),/future/);
});
test('rejects market closure or bad quality',()=>{
 let x=q();x.quality='STALE';
 assert.throws(()=>validatePaperQuote(x,opts()),/not healthy/);
 x=q();x.isMarketOpen=false;
 assert.throws(()=>validatePaperQuote(x,opts()),/not healthy/);
});
test('rejects missing simulation entitlement',()=>{
 let x=q();delete x.entitlement;
 assert.throws(()=>validatePaperQuote(x,opts()),/not authorized/);
});
test('rejects crossed quotes and excessive spreads',()=>{
 let x=q();x.bid=102;
 assert.throws(()=>validatePaperQuote(x,opts()),/crossed/);
 x=q();x.ask=110;
 assert.throws(()=>validatePaperQuote(x,opts()),/spread/);
});
test('rejects invalid symbol, side, units and nonpositive prices',()=>{
 let x=q();x.bid='0';
 assert.throws(()=>validatePaperQuote(x,opts()),/positive/);
 x=q();x.unit='USD/?';
 assert.throws(()=>validatePaperQuote(x,opts()),/canonical/);
 assert.throws(()=>validatePaperQuote(q(),opts('BUY')),/side/);
 assert.throws(()=>validatePaperQuote(q(),{...opts(),symbol:'BTC_USD'}),/symbol mismatch/);
});
test('rejects unattested source lists and invalid tolerances',()=>{
 assert.throws(()=>validatePaperQuote(q(),{...opts(),approvedSources:[]}),/source not approved/);
 assert.throws(()=>validatePaperQuote(q(),{...opts(),maxAgeMs:100000}),/freshness/);
});
