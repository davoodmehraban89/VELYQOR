import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateQuoteGate} from '../src/alert-data-gate.mjs';
import {stepAlert,markNotified} from '../src/informational-alert-engine.mjs';
import {notificationRecord,claimDelivery,recordDeliveryOutcome} from '../src/notification-outbox.mjs';
import {baleOneMessage} from '../src/bale-once-adapter.mjs';
import {inspectTwoSources} from '../src/licensed-provider-selector.mjs';

const now=Date.parse('2026-10-21T12:30:00.000Z');
const t=i=>new Date(now-300000+i*60000).toISOString();
const entitlement={publicDisplay:true,derivedAlerts:true};
const o=(i,price,extra={})=>({provider:'S1',symbol:'USD_IRT_FREE',unit:'IRT_PER_USD',
  side:'SELL',price,timestamp:t(i),permission:entitlement,...extra});
const cfg={nowMs:now,config:{maxAgeMs:10*60000,recoverySamples:1}};
const rule={id:'user-optin-test',provider:'S1',symbol:'USD_IRT_FREE',unit:'IRT_PER_USD',
  legs:[{type:'ABOVE',side:'SELL',threshold:1050}]};
const gate=(state,quote,opts={})=>evaluateQuoteGate(state,quote,{...cfg,...opts});
test('functional integration: spike quarantined until second fresh independent sample; then one threshold event',()=>{
 const a=gate(null,o(0,1000));
 const before=stepAlert(rule,null,o(0,1000),a);
 assert.equal(before.events.length,0);
 const spike=gate(a.state,o(1,1100));
 assert.equal(spike.status,'SPIKE_PENDING');
 const blocked=stepAlert(rule,before.state,o(1,1100),spike);
 assert.equal(blocked.events.length,0);
 assert.equal(blocked.reason,'QUALITY_HOLD');
 const confirmed=gate(spike.state,o(2,1101));
 assert.equal(confirmed.status,'GOOD');
 const fired=stepAlert(rule,blocked.state,o(2,1101),confirmed);
 assert.equal(fired.events.length,1);
 assert.equal(fired.events[0].kind,'INFORMATIONAL_THRESHOLD');
 assert.equal(stepAlert(rule,fired.state,o(3,1101),gate(confirmed.state,o(3,1101))).events.length,0);
});
test('security integration: rights and cross-source disagreement block all downstream alerts',()=>{
 const unlicensed=o(1,1100,{permission:null});
 assert.equal(gate(null,unlicensed).accepted,null);
 assert.equal(stepAlert(rule,null,unlicensed,gate(null,unlicensed)).events.length,0);
 const a=o(1,1100),b=o(1,1300,{provider:'S2'});
 const checked=inspectTwoSources(a,b,{nowMs:now,maxAgeMs:600000});
 assert.equal(checked.status,'SOURCE_DIVERGENCE');
 assert.equal(checked.observation,null);
 assert.equal(checked.alertsSuspended,true);
});
test('send-outcome integration: accepted Bale response advances, ambiguous outcome is terminal',async()=>{
 const start=gate(null,o(2,1101));
 const fired=stepAlert(rule,null,o(2,1101),start);
 assert.equal(fired.events.length,1);
 const eventId=fired.events[0].id;
 const message=notificationRecord({id:'msg-1',eventId,recipientChannel:'BALE',createdAt:t(2)});
 let outbox=claimDelivery(message,{now:t(2)}).record;
 const token='123456:syntheticTransportTokenPlaceholderOnly';
 const accepted=await baleOneMessage({token,chatId:'12345',text:'آزمون اطلاع‌رسانی، توصیه مالی نیست',
  transport:async url=>url.endsWith('/getChat')?
  {status:200,json:async()=>({ok:true,result:{id:12345,type:'private'}})}:
  {status:200,json:async()=>({ok:true,result:{chat:{id:12345},message_id:7}})}});
 assert.equal(accepted.status,'SENT');
 outbox=recordDeliveryOutcome(outbox,{at:t(3),success:true,providerMessageId:accepted.messageId});
 assert.equal(outbox.status,'SENT');
 const notified=markNotified(rule,fired.state,{eventId,at:t(3),deliveryId:outbox.providerMessageId});
 assert.equal(notified.phase,'NOTIFIED');
 let n=claimDelivery(notificationRecord({id:'msg-2',eventId,recipientChannel:'BALE',createdAt:t(2)}),{now:t(2)}).record;
 const unknown=await baleOneMessage({token,chatId:'12345',text:'آزمون',
  transport:async url=>url.endsWith('/getChat')?
   {status:200,json:async()=>({ok:true,result:{id:12345,type:'private'}})}:
   {status:503,json:async()=>({ok:false})}});
 assert.equal(unknown.status,'UNKNOWN');
 n=recordDeliveryOutcome(n,{at:t(3),success:false,unknown:true});
 assert.equal(n.status,'UNKNOWN');
 assert.equal(claimDelivery(n,{now:t(4)}).claimed,false);
});
