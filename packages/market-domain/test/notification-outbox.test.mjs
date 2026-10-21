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
test('expired in-flight lease is unknown, not automatically retried',()=>{
 let n=claimDelivery(fresh(),{now:at(0),leaseMs:30000}).record;
 assert.equal(claimDelivery(n,{now:at(0)}).claimed,false);
 const expired=claimDelivery(n,{now:at(1)});
 assert.equal(expired.claimed,false);
 assert.equal(expired.record.status,'UNKNOWN');
 assert.equal(expired.record.reason,'LEASE_EXPIRED_DELIVERY_UNCERTAIN');
 assert.equal(claimDelivery(expired.record,{now:at(9)}).claimed,false);
});
test('reject malformed channels and negative retries',()=>{
 assert.throws(()=>notificationRecord({id:'x',eventId:'e',recipientChannel:'TELEGRAM',createdAt:at(0)}));
 assert.throws(()=>claimDelivery(fresh(),{now:at(0),leaseMs:-1}));
 assert.throws(()=>acknowledgeDelivery(fresh(),{at:at(1)}));
});

test('transport timeout after sending has unknown result and never retries',()=>{
 let n=claimDelivery(fresh(),{now:at(0)}).record;
 n=recordDeliveryOutcome(n,{at:at(1),success:false,unknown:true});
 assert.equal(n.status,'UNKNOWN');
 assert.equal(n.reason,'OUTCOME_UNKNOWN_RECONCILE_MANUALLY');
 assert.equal(n.nextRetryAt,null);
 assert.equal(claimDelivery(n,{now:at(20)}).claimed,false);
 assert.match(notificationUiStatus(n),/نامشخص/);
});
test('unknown delivery cannot assert success or go backwards in time',()=>{
 const n=claimDelivery(fresh(),{now:at(2)}).record;
 assert.throws(()=>recordDeliveryOutcome(n,{at:at(3),success:true,unknown:true}));
 assert.throws(()=>recordDeliveryOutcome(n,{at:at(1),success:false}));
 assert.equal(recordDeliveryOutcome(n,{at:at(3),success:false}).status,'FAILED');
});

test('crash immediately after message attempt cannot cause a second send after lease expires',()=>{
 const r=notificationRecord({id:'outbox-crash',eventId:'event-crash',
  recipientChannel:'BALE',createdAt:at(0)});
 const first=claimDelivery(r,{now:at(0),leaseMs:1000});
 assert.equal(first.claimed,true);
 const second=claimDelivery(first.record,{now:at(1)});
 assert.equal(second.claimed,false);
 assert.equal(second.record.status,'UNKNOWN');
 assert.equal(second.record.nextRetryAt,null);
 assert.match(notificationUiStatus(second.record),/نامشخص/);
});
