import test from 'node:test';
import assert from 'node:assert/strict';
import {singleTest,tokenOK,chatOK,safeSummary} from './bale-one-message-test.mjs';
const token='123456:abcDEFghiJKLmnoPQRstuVW';
test('dry run does not inspect secrets or use network',async()=>{
 let called=false;
 const r=await singleTest({transport:()=>{called=true;throw Error('unwanted network')},env:{}});
 assert.equal(r.status,'NOT_SENT');assert.equal(called,false);
});
test('requires token, chat and exact consent before sending',async()=>{
 await assert.rejects(()=>singleTest({mode:'--send',env:{}}),/BALE_BOT_TOKEN/);
 await assert.rejects(()=>singleTest({mode:'--send',env:{BALE_BOT_TOKEN:token}}),/CONSENT/);
 await assert.rejects(()=>singleTest({mode:'--send',env:{BALE_BOT_TOKEN:token,BALE_TEST_CONSENT:'I_OWN_THIS_CHAT'}}),/CHAT_ID/);
 assert.equal(chatOK('0'),false);
 assert.equal(chatOK('-100123456'),false);
 assert.equal(chatOK('9999999999999999'),false);
 assert.equal(chatOK('1234567'),true);
 assert.equal(tokenOK('bad/foo?'),false);
});
test('preflight verifies private chat and transmits exactly one outgoing message',async()=>{
 let checks=0, sent=0;
 const r=await singleTest({
  mode:'--send',env:{BALE_BOT_TOKEN:token,BALE_CHAT_ID:'456789',BALE_TEST_CONSENT:'I_OWN_THIS_CHAT'},
  transport:async(uri,opt)=>{
   assert.ok(uri.startsWith('https://tapi.bale.ai/bot'));
   assert.equal(opt.method,'POST');
   const body=JSON.parse(opt.body);
   assert.equal(body.chat_id,'456789');
   if(uri.endsWith('/getChat')){
    checks++;
    assert.equal(sent,0);
    return {status:200,json:async()=>({ok:true,result:{id:456789,type:'private'}})};
   }
   assert.ok(uri.endsWith('/sendMessage'));
   sent++;
   assert.equal(checks,1);
   assert.ok(body.text.includes('آزمایشی'));
   return {status:200,json:async()=>({ok:true,result:{chat:{id:456789},message_id:101}})};
  }
 });
 assert.equal(checks,1);assert.equal(sent,1);
 assert.equal(r.status,'Bale_API_ACCEPTED_NOT_READ_CONFIRMED');
 assert.equal(r.messageId,101);
 assert.ok(!JSON.stringify(r).includes(token));
});
test('wrong, group or unverified recipient fails before any message is sent',async()=>{
 for(const chat of [
  {id:456789,type:'group'},
  {id:456790,type:'private'},
  {id:456789},
  null
 ]){
  let sent=0;
  const result=await singleTest({
   mode:'--send',
   env:{BALE_BOT_TOKEN:token,BALE_CHAT_ID:'456789',BALE_TEST_CONSENT:'I_OWN_THIS_CHAT'},
   transport:async(uri)=>{
    if(uri.endsWith('/getChat'))return {status:200,json:async()=>({ok:true,result:chat})};
    sent++;
    throw Error('Unauthorized send');
   }
  });
  assert.equal(result.status,'FAILED');
  assert.equal(result.reason,'private_chat_preflight_failed_redacted');
  assert.equal(sent,0);
 }
});
test('redacts full error payload and refuses mismatched chat',()=>{
 assert.deepEqual(safeSummary({ok:false,description:'SECRET TOKEN',error_code:403},403,'13'),
   {status:'FAILED',httpStatus:403,reason:'bale_api_error_redacted'});
 assert.equal(safeSummary({ok:true,result:{chat:{id:9},message_id:10}},200,'13').status,'FAILED');
});
test('discover only matches consent nonce and ignores other chats',async()=>{
 let count=0;
 const r=await singleTest({mode:'--discover',
  env:{BALE_BOT_TOKEN:token,BALE_DISCOVERY_NONCE:'abc123TEST'},
  transport:async(uri,opt)=>{
   count++;
   assert.ok(uri.endsWith('/getUpdates'));
   return {status:200,json:async()=>({ok:true,result:[
    {message:{chat:{id:1,type:'private'},text:'/start wrong'}},
    {message:{chat:{id:2,type:'private'},text:'/start abc123TEST'}},
    {message:{chat:{id:3,type:'private'},text:'/start something'}},
    {message:{chat:{id:-100999,type:'supergroup'},text:'/start abc123TEST'}}
   ]})};
  }
 });
 assert.equal(count,1);assert.deepEqual(r,{status:'CHAT_FOUND',chatId:'2'});
});

test('refuses discovery message without verifiable private chat metadata',async()=>{
 const r=await singleTest({mode:'--discover',
  env:{BALE_BOT_TOKEN:token,BALE_DISCOVERY_NONCE:'abc123TEST'},
  transport:async()=>({status:200,json:async()=>({ok:true,result:[
    {message:{chat:{id:2},text:'/start abc123TEST'}},
    {message:{chat:{id:-123,type:'group'},text:'/start abc123TEST'}}
  ]})})
 });
 assert.equal(r.status,'NOT_VERIFIED');
});
