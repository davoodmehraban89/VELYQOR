/**
 * Domain-to-PostgreSQL integration boundary (NO broker or notification send).
 * Intended for a trusted server with a verified auth principal, a rights-aware
 * data gate and the independently tested PR #33 stepAlert function.
 *
 * Depends on PR #34 outbox and 0006_alert_runtime_atomic.sql.
 * No DB library import, transport, secrets, browser API or market-data fetch.
 * Caller injects trusted pg.query + deterministic domain functions.
 * NEVER expose as a browser-callable endpoint without separate auth review.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CHANNELS=new Set(['BALE','EITA','PWA']);
const NON_ADVISORY='اطلاعات آموزشی و غیرتوصیه‌ای';
const sqlRead='SELECT revision, state FROM public.alert_rule_runtime WHERE user_id = $1::uuid AND rule_key = $2::text';
const sqlCommit='SELECT outcome, new_revision, outbox_id FROM public.alert_rule_commit($1::uuid, $2::text, $3::bigint, $4::jsonb, $5::text, $6::text, $7::uuid, $8::timestamptz)';
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

function safeRevision(v){
 const n=typeof v==='string'&&/^\d{1,16}$/.test(v)?Number(v):v;
 if(!Number.isSafeInteger(n)||n<0)throw new TypeError('unsafe alert revision');
 return n;
}
function ensureEvent(event,rule,quote,gate,next){
 if(!event||event.kind!=='INFORMATIONAL_THRESHOLD'||
   event.ruleId!==rule.id||event.symbol!==rule.symbol||
   event.source!==rule.provider||event.side!==quote.side||
   event.price!==quote.price||event.at!==quote.timestamp||
   event.legIndex<0||!Number.isInteger(event.legIndex)||
   !rule.legs[event.legIndex]||event.ruleType!==rule.legs[event.legIndex].type||
   !event.labels?.includes(NON_ADVISORY)||
   typeof event.id!=='string'||event.id.length>128||event.id.length<1||
   !/^[\x20-\x7E]+$/.test(event.id)||
   next.state.phase!=='TRIGGERED'||next.state.eventId!==event.id||
   next.state.triggeredAt!==event.at||
   gate.status!=='GOOD'||gate.alertsSuspended||
   gate.accepted?.timestamp!==quote.timestamp||
   gate.accepted?.provider!==rule.provider||
   gate.accepted?.unit!==rule.unit||
   gate.accepted?.symbol!==rule.symbol||
   gate.accepted?.side!==quote.side||
   gate.accepted?.price!==quote.price)
   throw new Error('UNVERIFIED_EVENT_PROVENANCE');
}
function validateArgs({db,domain,principal,rule,recipient,observation,now}){
 if(typeof db?.query!=='function'||typeof domain?.evaluateQuoteGate!=='function'||
    typeof domain?.stepAlert!=='function')throw new TypeError('trusted database/domain functions required');
 if(principal?.kind!=='VERIFIED_SERVER_PRINCIPAL'||principal.verified!==true||
    !ID.test(principal.userId))
   throw new TypeError('verified server user required');
 if(typeof rule?.id!=='string'||rule.id.length<1||rule.id.length>96||
    typeof rule.provider!=='string'||!rule.provider||
    typeof rule.symbol!=='string'||!rule.symbol||
    typeof rule.unit!=='string'||!rule.unit||
    !Array.isArray(rule.legs))
   throw new TypeError('trusted rule contract required');
 if(!ID.test(recipient?.recipientRef)||!ALLOWED_CHANNELS.has(recipient?.channel)||
   recipient.optInVerified!==true)
   throw new TypeError('verified recipient mapping required');
 if(!observation||typeof observation!=='object')
   throw new TypeError('observation required');
 if(typeof now!=='string'||!Number.isFinite(Date.parse(now)))
   throw new TypeError('valid server time required');
}
/**
 * @returns {outcome,revision,outboxId,reason} without user private data.
 * Database provides row-locked compare-and-swap. At most three refreshed
 * retries are allowed after STALE_REVISION to resolve Worker races.
 */
export async function evaluateAndPersistAlert({
 db,domain,principal,rule,recipient,observation,now,
 gateOptions={},maxAttempts=3
}){
 validateArgs({db,domain,principal,rule,recipient,observation,now});
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5)
   throw new RangeError('maxAttempts');
 const userId=principal.userId,ruleId=rule.id;
 const gateConfig={...gateOptions,nowMs:Date.parse(now)};
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const r=await db.query(sqlRead,[userId,ruleId]);
  if(!Array.isArray(r?.rows)||r.rows.length>1)
   throw new Error('CORRUPT_ALERT_STATE_RESULT');
  const row=r.rows[0];
  const revision=row?safeRevision(row.revision):0;
  const snapshot=row?.state??null;
  if(snapshot!==null&&(typeof snapshot!=='object'||Array.isArray(snapshot)))
   throw new Error('CORRUPT_ALERT_STATE');
  const previousAlert=snapshot?.alert??null;
  if(previousAlert?.phase==='TRIGGERED'||previousAlert?.phase==='NOTIFIED'||
     previousAlert?.phase==='CLOSED')
   return {outcome:'ALREADY_TERMINAL',revision,outboxId:null,reason:'NOT_REARMED'};
  const evaluation=domain.evaluateQuoteGate(snapshot?.gate??null,observation,gateConfig);
  if(!evaluation||typeof evaluation.status!=='string'||!evaluation.state)
   throw new Error('INVALID_DOMAIN_GATE');
  const computed=domain.stepAlert(rule,previousAlert,observation,evaluation);
  if(!computed||!computed.state||!Array.isArray(computed.events)||
    computed.events.length>1)
   throw new Error('INVALID_DOMAIN_EVALUATION');
  const event=computed.events[0]??null;
  if(event)ensureEvent(event,rule,observation,evaluation,computed);
  // Suspensions and recovery are preserved durably, even with no alert event.
  if(!event&&computed.state.phase!=='ARMED')
   throw new Error('EVENTLESS_TERMINAL_TRANSITION');
  const nextState={alert:computed.state,gate:evaluation.state};
  const values=[
   userId,ruleId,revision,JSON.stringify(nextState),
   event?.id??null,event?recipient.channel:null,
   event?recipient.recipientRef:null,now
  ];
  const saved=await db.query(sqlCommit,values);
  if(!Array.isArray(saved?.rows)||saved.rows.length!==1||
    !hasOwn(saved.rows[0],'outcome'))throw new Error('CORRUPT_CAS_RESULT');
  const result=saved.rows[0];
  if(result.outcome==='STALE_REVISION')continue;
  if(result.outcome==='ALREADY_TERMINAL')
   return {outcome:'ALREADY_TERMINAL',revision:safeRevision(result.new_revision),
      outboxId:null,reason:'RACED_WITH_TERMINAL_ALERT'};
  if(!['STATE_SAVED','TRIGGERED_ENQUEUED'].includes(result.outcome)||
    Boolean(event)!==(result.outcome==='TRIGGERED_ENQUEUED')||
    Boolean(result.outbox_id)!==Boolean(event))
   throw new Error('PERSISTENCE_RESULT_MISMATCH');
  return {outcome:result.outcome,revision:safeRevision(result.new_revision),
   outboxId:result.outbox_id??null,reason:computed.reason};
 }
 return {outcome:'REVISION_CONFLICT',revision:null,outboxId:null,
    reason:'RETRY_LIMIT_REACHED_NO_NEW_ALERT'};
}
