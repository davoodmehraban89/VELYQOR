/**
 * Server-only notification egress coordinator.
 * Consumes a DB-backed ONE-SEND permit, then rechecks consent and finally
 * invokes the PR #33 Bale adapter through a trusted injected callback.
 * No secrets persisted or logged; this module never self-schedules/retries.
 *
 * Depends on PR #34 outbox + migration 0006 begin_egress/egress_allowed.
 * NOT PRODUCTION-AUTHORIZED: sender role and recipient ownership unverified.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const beginSql='SELECT public.alert_notification_begin_egress($1::uuid,$2::uuid,$3::timestamptz) AS permitted';
const egressSql='SELECT public.alert_notification_egress_allowed($1::uuid,$2::uuid,$3::timestamptz) AS permitted';
const finishSql='SELECT public.notification_outbox_finish($1::uuid,$2::uuid,$3::text,$4::text,$5::timestamptz,60) AS outcome';
async function permitted(db,sql,params){
 const result=await db.query(sql,params);
 if(!Array.isArray(result?.rows)||result.rows.length!==1||
   typeof result.rows[0].permitted!=='boolean')
  throw new Error('UNTRUSTED_DB_AUTHORIZATION_RESPONSE');
 return result.rows[0].permitted;
}
async function finish(db,{outboxId,claimToken,decision,messageId,at}){
 const r=await db.query(finishSql,[outboxId,claimToken,decision,messageId,at]);
 if(!Array.isArray(r?.rows)||r.rows.length!==1||
    typeof r.rows[0].outcome!=='string')
  throw new Error('UNTRUSTED_DB_COMPLETION_RESPONSE');
 return r.rows[0].outcome;
}
export async function dispatchLeasedBale({
 db,baleOneMessage,outboxId,claimToken,token,chatId,text,at
}={}){
 if(typeof db?.query!=='function'||typeof baleOneMessage!=='function'||
    !uuid.test(outboxId)||!uuid.test(claimToken)||
    typeof at!=='string'||!Number.isFinite(Date.parse(at)))
  throw new TypeError('invalid server dispatch prerequisites');
 if(typeof token!=='string'||token.length<12||
    typeof chatId!=='string'||!/^[1-9][0-9]{0,15}$/.test(chatId)||
    typeof text!=='string'||text.length<1||text.length>1000)
  throw new TypeError('invalid private dispatch data');
 const params=[outboxId,claimToken,at];
 // Linearization point: this SQL row UPDATE makes a second caller unable
 // to obtain another send permit. No network call occurs before success.
 if(!await permitted(db,beginSql,params))
  return {status:'BLOCKED',reason:'SEND_PERMIT_NOT_AVAILABLE',sent:false};
 // Check opt-in immediately before network. A revoked recipient is blocked.
 if(!await permitted(db,egressSql,params)){
  const state=await finish(db,{outboxId,claimToken,decision:'UNKNOWN',
    messageId:null,at});
  return {status:'BLOCKED',reason:'RECIPIENT_NOT_CURRENTLY_AUTHORIZED',
    persistedOutcome:state,sent:false};
 }
 let outcome;
 try{outcome=await baleOneMessage({token,chatId,text})}
 catch{outcome={status:'UNKNOWN'}}
 // Any ambiguous transport error is terminal UNKNOWN, not an auto retry.
 const accepted=outcome?.status==='SENT'&&
   typeof outcome.messageId==='string'&&outcome.messageId.length>0;
 const persistedOutcome=await finish(db,{outboxId,claimToken,
   decision:accepted?'SENT':'UNKNOWN',
   messageId:accepted?outcome.messageId:null,at});
 if(accepted&&persistedOutcome==='SENT')
  return {status:'PROVIDER_ACCEPTED',messageId:outcome.messageId,
    persistedOutcome,sent:true,readConfirmed:false};
 return {status:'UNKNOWN',reason:'OUTBOUND_RESULT_UNVERIFIED_OR_NOT_PERSISTED',
  persistedOutcome,sent:accepted,readConfirmed:false};
}
