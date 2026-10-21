/**
 * Notification outbox state transitions; transport injected, never imported.
 * Caller MUST persist via an atomic compare-and-swap store for cross-worker
 * idempotency. Pure logic cannot promise exactly-once network delivery.
 */
const allowed=new Set(['PENDING','LEASED','SENT','FAILED','UNKNOWN','ACKNOWLEDGED']);
export function notificationRecord({id,recipientChannel,eventId,createdAt,maxAttempts=3}){
 if(typeof id!=='string'||!id||typeof eventId!=='string'||!eventId||
    !['BALE','PWA','EITA'].includes(recipientChannel)||!Number.isInteger(maxAttempts)||
    maxAttempts<1||maxAttempts>10||!Number.isFinite(Date.parse(createdAt)))
  throw new RangeError('invalid message metadata');
 return {id,eventId,recipientChannel,status:'PENDING',createdAt,
  attempts:0,maxAttempts,leasedAt:null,leaseUntil:null,providerMessageId:null,deliveredAt:null,
  failedAt:null,nextRetryAt:null,reason:null};
}
export function claimDelivery(record,{now,leaseMs=30000}){
 if(!allowed.has(record?.status)||!Number.isFinite(Date.parse(now))||
    !Number.isSafeInteger(leaseMs)||leaseMs<=0)throw new RangeError('invalid claim');
 if(record.status==='SENT'||record.status==='ACKNOWLEDGED'||record.status==='UNKNOWN'||record.attempts>=record.maxAttempts)
  return {record,claimed:false};
 const at=Date.parse(now);
 if(record.status==='LEASED'&&Date.parse(record.leaseUntil)>at)
  return {record,claimed:false};
 if(record.nextRetryAt&&Date.parse(record.nextRetryAt)>at)
  return {record,claimed:false};
 const updated={...record,status:'LEASED',attempts:record.attempts+1,
  leasedAt:now,leaseUntil:new Date(at+leaseMs).toISOString(),nextRetryAt:null};
 return {record:updated,claimed:true};
}
export function recordDeliveryOutcome(record,{at,success,unknown=false,providerMessageId=null,retryDelayMs=60000}){
 if(record?.status!=='LEASED'||typeof at!=='string'||!Number.isFinite(Date.parse(at))||
    !Number.isFinite(Date.parse(record.leasedAt))||
    Date.parse(at)<Date.parse(record.leasedAt)||typeof success!=='boolean'||
    typeof unknown!=='boolean'||(unknown&&success)||
    !Number.isSafeInteger(retryDelayMs)||retryDelayMs<1000)
  throw new RangeError('invalid completion');
 // Network timeout after a POST is ambiguous: it might already have been accepted.
 // Automatic retry risks duplicate user notifications; require manual reconciliation.
 if(unknown)return {...record,status:'UNKNOWN',leaseUntil:null,failedAt:at,
   nextRetryAt:null,reason:'OUTCOME_UNKNOWN_RECONCILE_MANUALLY'};
 if(success){
  if(typeof providerMessageId!=='string'||!providerMessageId)
   throw new RangeError('verified provider message ID required');
  return {...record,status:'SENT',leaseUntil:null,providerMessageId,
    deliveredAt:at,reason:null};
 }
 const exhausted=record.attempts>=record.maxAttempts;
 return {...record,status:'FAILED',leaseUntil:null,failedAt:at,
   nextRetryAt:exhausted?null:new Date(Date.parse(at)+retryDelayMs).toISOString(),
   reason:exhausted?'ATTEMPTS_EXHAUSTED':'RETRY_PENDING'};
}
export function acknowledgeDelivery(record,{at}){
 if(record?.status!=='SENT'||!Number.isFinite(Date.parse(at))||
    Date.parse(at)<Date.parse(record.deliveredAt))
  throw new RangeError('only sent messages may be acknowledged');
 return {...record,status:'ACKNOWLEDGED',acknowledgedAt:at};
}
export function notificationUiStatus(record){
 switch(record?.status){
  case 'PENDING':return 'در صف ارسال';
  case 'LEASED':return 'در حال تلاش برای ارسال';
  case 'SENT':return 'ارسال توسط ارائه‌دهنده پذیرفته شد؛ مشاهده کاربر تأییدنشده';
  case 'ACKNOWLEDGED':return 'دریافت توسط کاربر تأیید شد';
  case 'UNKNOWN':return 'نتیجهٔ ارسال نامشخص است؛ برای جلوگیری از پیام تکراری تلاش مجدد متوقف شد';
  case 'FAILED':return record.reason==='ATTEMPTS_EXHAUSTED'?'ارسال ناموفق؛ تلاش مجدد متوقف شد':'ارسال ناموفق؛ تلاش مجدد زمان‌بندی شده';
  default:return 'وضعیت اعلان تأییدنشده';
 }
}
