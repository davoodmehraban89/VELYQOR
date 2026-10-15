/**
 * Owner-operated ONE-message Bale diagnostic. No execution unless --send.
 * Keep BALE_BOT_TOKEN exclusively in a local shell secret environment; never
 * paste to chat, terminal arguments, public GitHub logs or CI.
 *
 * --dry-run : no network (default)
 * --discover: identify ONE consenting chat by a nonce-bearing /start message
 * --send    : explicitly send ONE message, never auto-retry
 */
import {pathToFileURL} from 'node:url';

const HOST='https://tapi.bale.ai';
const MODE_SET=new Set(['--dry-run','--discover','--send']);
export function tokenOK(value) {
 return typeof value==='string'&&/^[0-9]{4,20}:[A-Za-z0-9_-]{12,180}$/.test(value);
}
export function chatOK(value){
 return typeof value==='string'&&/^-?[0-9]{1,17}$/.test(value)&&value!=='0';
}
export function safeSummary(result,httpStatus,expectedChat){
 if(!result||result.ok!==true||httpStatus<200||httpStatus>=300) {
   return {status:'FAILED',httpStatus:Number(httpStatus)||null,reason:'bale_api_error_redacted'};
 }
 const got=result.result?.chat?.id;
 const msg=result.result?.message_id;
 if(!Number.isSafeInteger(msg)||String(got)!==expectedChat)
   return {status:'FAILED',httpStatus,reason:'chat_or_message_id_mismatch'};
 return {status:'Bale_API_ACCEPTED_NOT_READ_CONFIRMED',httpStatus,messageId:msg};
}
export async function postMethod(method,body,{token,transport=fetch}){
 if(!tokenOK(token)||!['getUpdates','sendMessage'].includes(method))
   throw Error('Invalid Bale request inputs');
 const response=await transport(HOST+'/bot'+token+'/'+method,{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify(body),
   signal:AbortSignal.timeout(12000),
   redirect:'error'
 });
 const status=response.status;
 let data;
 try{data=await response.json()}catch{data=null}
 // Do not log original URL, token, response raw body, incoming message text.
 return {status,data};
}
export async function singleTest({mode='--dry-run',env=process.env,transport=fetch}={}){
 if(!MODE_SET.has(mode))throw Error('Unknown mode');
 if(mode==='--dry-run')
   return {status:'NOT_SENT',required:['BALE_BOT_TOKEN','BALE_CHAT_ID','BALE_TEST_CONSENT=I_OWN_THIS_CHAT'],
     docs:'https://docs.bale.ai/'};
 const token=env.BALE_BOT_TOKEN;
 if(!tokenOK(token))throw Error('BALE_BOT_TOKEN missing or malformed; do not print token');
 if(mode==='--discover'){
   const nonce=env.BALE_DISCOVERY_NONCE;
   if(typeof nonce!=='string'||!/^[-_A-Za-z0-9]{8,64}$/.test(nonce))
     throw Error('BALE_DISCOVERY_NONCE must be a random 8-64 character value');
   const r=await postMethod('getUpdates',{limit:100,timeout:0},{token,transport});
   if(r.status!==200||r.data?.ok!==true)
     return {status:'FAILED',reason:'getUpdates_not_available_or_webhook_active',httpStatus:r.status};
   const matches=(r.data.result||[]).filter(u=>{
     const text=u?.message?.text||'';
     return text===('/start '+nonce)||text===('CHARTNOVA_TEST_'+nonce);
   }).map(u=>String(u.message.chat.id));
   const unique=[...new Set(matches)];
   return unique.length===1?{status:'CHAT_FOUND',chatId:unique[0]}:
     {status:'NOT_VERIFIED',reason:'need_one_unambiguous_user_opt_in_message'};
 }
 if(env.BALE_TEST_CONSENT!=='I_OWN_THIS_CHAT')
   throw Error('Explicit BALE_TEST_CONSENT required');
 const chatId=env.BALE_CHAT_ID;
 if(!chatOK(chatId))throw Error('BALE_CHAT_ID missing or malformed');
 const text='[ChartNova] پیام آزمایشی کانال بله. این یک آزمون ارتباطی است؛ هشدار قیمت یا توصیه مالی نیست.';
 const r=await postMethod('sendMessage',{chat_id:chatId,text},{token,transport});
 return safeSummary(r.data,r.status,chatId);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{
  const mode=process.argv[2]||'--dry-run';
  const result=await singleTest({mode});
  console.log(JSON.stringify(result));
  if(['FAILED','NOT_VERIFIED'].includes(result.status))process.exitCode=1;
 }catch(e){
  console.error(JSON.stringify({status:'FAILED',reason:'local_verification_or_network_failed_redacted'}));
  process.exitCode=1;
 }
}
