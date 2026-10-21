import test from 'node:test';import assert from 'node:assert/strict';
import {baleOneMessage} from '../src/bale-once-adapter.mjs';
const token='123456:aVeryLongSyntheticNeverRealToken';
const args={token,chatId:'23456',text:'این پیام صرفاً آزمایشی است',transport:null};
test('private preflight then exactly one Bale sendMessage call',async()=>{
 const methods=[];
 const r=await baleOneMessage({...args,transport:async(url,opt)=>{
  methods.push(url.split('/').at(-1));assert.equal(opt.method,'POST');
  return {status:200,json:async()=>url.endsWith('/getChat')?
    ({ok:true,result:{type:'private',id:23456}}):
    ({ok:true,result:{chat:{id:23456},message_id:987}})};
 }});
 assert.deepEqual(methods,['getChat','sendMessage']);assert.equal(r.status,'SENT');
 assert.ok(!JSON.stringify(r).includes(token));assert.equal(r.code,'PROVIDER_ACCEPTED_NOT_READ')
});
test('never send to group or mismatched private chat',async()=>{
 for(const info of [{type:'group',id:23456},{type:'private',id:2},null]){
  let sent=0;
  const r=await baleOneMessage({...args,transport:async url=>{
   if(url.endsWith('sendMessage')){sent++;throw Error('must not send')}
   return {status:200,json:async()=>({ok:true,result:info})};
  }});
  assert.equal(sent,0);assert.equal(r.code,'PRIVATE_RECIPIENT_UNVERIFIED')
 }
});
test('network outcome ambiguity is not reported as sent and is never retried',async()=>{
 let calls=0;
 const r=await baleOneMessage({...args,transport:async url=>{
  calls++;
  if(url.endsWith('/getChat'))return {status:200,json:async()=>({ok:true,result:{type:'private',id:23456}})};
  throw Error('token could be in transport exception');
 }});
 assert.equal(calls,2);assert.deepEqual(r,{status:'UNKNOWN',code:'DELIVERY_OUTCOME_UNKNOWN_NO_AUTO_RETRY'});
 assert.ok(!JSON.stringify(r).includes(token))
});
test('invalid recipient IDs and token are rejected before network',async()=>{
 for(const chatId of ['-123','0','12345678901234567','abc']){
  await assert.rejects(()=>baleOneMessage({...args,chatId,transport:()=>{throw Error('network unexpected')}}))
 }
 await assert.rejects(()=>baleOneMessage({...args,token:'test'}))
});
test('API 500 or invalid response does not assert provider delivery',async()=>{
 const r=await baleOneMessage({...args,transport:async url=>{
  if(url.endsWith('/getChat'))return {status:200,json:async()=>({ok:true,result:{type:'private',id:23456}})};
  return {status:500,json:async()=>({ok:false})};
 }});
 assert.equal(r.status,'UNKNOWN');
 assert.equal(r.code,'DELIVERY_OUTCOME_UNKNOWN_NO_AUTO_RETRY')
});

test('malformed success JSON after send is unknown rather than safe to retry',async()=>{
 let sends=0;
 const r=await baleOneMessage({...args,transport:async url=>{
  if(url.endsWith('/getChat'))return {status:200,json:async()=>({ok:true,result:{type:'private',id:23456}})};
  sends++;
  return {status:200,json:async()=>{throw new Error('partial transport output')}};
 }});
 assert.equal(sends,1);
 assert.equal(r.status,'UNKNOWN');
 assert.equal(r.code,'DELIVERY_OUTCOME_UNKNOWN_NO_AUTO_RETRY');
});
test('wrong response chat ID after send cannot be assumed a safe failure',async()=>{
 let sends=0;
 const r=await baleOneMessage({...args,transport:async url=>{
  if(url.endsWith('/getChat'))return {status:200,json:async()=>({ok:true,result:{type:'private',id:23456}})};
  sends++;
  return {status:200,json:async()=>({ok:true,result:{chat:{id:99999},message_id:5}})};
 }});
 assert.equal(sends,1);assert.equal(r.status,'UNKNOWN');
});
