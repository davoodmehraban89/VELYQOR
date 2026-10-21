import test from 'node:test';import assert from 'node:assert/strict';
import {notificationRecord,claimDelivery,recordDeliveryOutcome,acknowledgeDelivery,notificationUiStatus} from '../src/notification-outbox.mjs';
const at=n=>new Date(Date.parse('2026-10-21T12:00:00Z')+n*60000).toISOString();
const fresh=()=>notificationRecord({id:'n1',eventId:'e1',recipientChannel:'BALE',createdAt:at(0),maxAttempts:2});
test('fresh pending message has visible UI state and no send side effects',()=>{
 const n=fresh();assert.equal(n.status,'PENDING');assert.ok(notificationUiStatus(n).includes('صف'))
});
test('lease excludes concurrent claim in state machine',()=>{
 let n=fresh();let q=claimDelivery(n,{now:at(0)});assert.equal(q.claimed,true);
 n=q.record;assert.equal(n.attempts,1);
 assert.equal(claimDelivery(n,{now:at(0)}).claimed,false);
});
test('success requires explicit provider proof; never marks read confirmation automatically',()=>{
 let n=claimDelivery(fresh(),{now:at(0)}).record;
 assert.throws(()=>recordDeliveryOutcome(n,{at:at(1),success:true}));
 n=recordDeliveryOutcome(n,{at:at(1),success:true,providerMessageId:'42'});
 assert.equal(n.status,'SENT');assert.ok(notificationUiStatus(n).includes('تأییدنشده'));
 assert.equal(claimDelivery(n,{now:at(2)}).claimed,false);
 n=acknowledgeDelivery(n,{at:at(3)});assert.equal(n.status,'ACKNOWLEDGED')
});
test('bounded retry after failure; no extra claim after exhausted',()=>{
 let n=claimDelivery(fresh(),{now:at(0)}).record;
 n=recordDeliveryOutcome(n,{at:at(1),success:false,retryDelayMs:60000});
 assert.equal(n.status,'FAILED');
 assert.equal(claimDelivery(n,{now:at(1)}).claimed,false);
 n=claimDelivery(n,{now:at(2)}).record;
 assert.equal(n.attempts,2);
 n=recordDeliveryOutcome(n,{at:at(3),success:false});
 assert.equal(n.reason,'ATTEMPTS_EXHAUSTED');
 assert.equal(claimDelivery(n,{now:at(9)}).claimed,false)
});
test('recover crashed worker lease only after lease expired',()=>{
 let n=claimDelivery(fresh(),{now:at(0),leaseMs:30000}).record;
 assert.equal(claimDelivery(n,{now:at(0)}).claimed,false);
 assert.equal(claimDelivery(n,{now:at(1)}).claimed,true)
});
test('reject malformed channels and negative retries',()=>{
 assert.throws(()=>notificationRecord({id:'x',eventId:'e',recipientChannel:'TELEGRAM',createdAt:at(0)}));
 assert.throws(()=>claimDelivery(fresh(),{now:at(0),leaseMs:-1}));
 assert.throws(()=>acknowledgeDelivery(fresh(),{at:at(1)}));
});
