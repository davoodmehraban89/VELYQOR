/**
 * One-message Bale transport, injected HTTP client only.
 * No automatic retries: timeout after send is ambiguous, never assert delivered.
 * Secret bot token stays in ephemeral call argument, never returned or logged.
 */
const HOST='https://tapi.bale.ai';
export async function baleOneMessage({token,chatId,text,transport}) {
 if(typeof token!=='string'||!(/^[0-9]{4,20}:[a-zA-Z0-9_-]{12,180}$/).test(token))
  throw new TypeError('invalid private token supplied');
 if(typeof chatId!=='string'||!(/^[1-9][0-9]{0,15}$/).test(chatId)||
    BigInt(chatId)>BigInt(Number.MAX_SAFE_INTEGER))
  throw new TypeError('invalid positive private recipient id');
 if(typeof text!=='string'||text.length<1||text.length>1000)
  throw new TypeError('invalid message length');
 if(typeof transport!=='function')throw new TypeError('inject transport explicitly');
 async function request(method,params){
  const url=HOST+'/bot'+token+'/'+method;
  // Never report URL, request body, raw upstream response, stack trace or token.
  const result=await transport(url,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(params),redirect:'error'});
  if(!result||result.status!==200)return null;
  let data;try{data=await result.json()}catch{return null}
  return data?.ok===true?data.result:null;
 }
 // Only positive numeric user IDs accepted; verify chat type immediately before send.
 let chat;
 try{chat=await request('getChat',{chat_id:chatId})}
 catch{return {status:'FAILED',code:'PREFLIGHT_NETWORK_ERROR'}}
 if(chat?.type!=='private'||String(chat.id)!==chatId)
  return {status:'FAILED',code:'PRIVATE_RECIPIENT_UNVERIFIED'};
 let result;
 try{result=await request('sendMessage',{chat_id:chatId,text})}
 catch{return {status:'UNKNOWN',code:'DELIVERY_OUTCOME_UNKNOWN_NO_AUTO_RETRY'}};
 if(!Number.isSafeInteger(result?.message_id)||String(result?.chat?.id)!==chatId)
  return {status:'UNKNOWN',code:'DELIVERY_OUTCOME_UNKNOWN_NO_AUTO_RETRY'};
 return {status:'SENT',code:'PROVIDER_ACCEPTED_NOT_READ',messageId:String(result.message_id)};
}
