import test from 'node:test';
import assert from 'node:assert/strict';
import accounts from '../_chinese-firebase/functions/accounts.js';
import {directoryRows,messageView,deletionView} from '../src/people-view.mjs';
const caller={uid:'learner',token:{email_verified:true,auth_time:Math.floor(Date.now()/1000)}};
const noDb={doc:()=>({get:async()=>({exists:false})})};
const service=accounts.createAccounts(noDb,{getUser:async id=>({uid:id,email:id==='owner'?'kstouras@gmail.com':'learner@example.invalid',disabled:false})});
test('directory and cross-account operations reject learners',async()=>{
 for(const d of [{action:'listUsers'},{action:'getMessages',uid:'other'},{action:'sendMessage',uid:'other',body:'hello'},{action:'readMessages',uid:'other',seq:5},{action:'deleteAccount',uid:'other',confirmation:'DELETE'}])await assert.rejects(()=>service.handle(d,caller,false,false),e=>e.code==='permission-denied');
});
test('deletion requires recent identity, exact confirmation and protects owner',async()=>{
 await assert.rejects(()=>service.handle({action:'deleteAccount'}, {...caller,token:{auth_time:1}},false,false),e=>e.code==='failed-precondition');
 await assert.rejects(()=>service.handle({action:'deleteAccount'},caller,false,false),e=>e.code==='invalid-argument');
 await assert.rejects(()=>service.handle({action:'deleteAccount',uid:'owner',confirmation:'DELETE'},caller,true,false),e=>e.code==='permission-denied');
 await assert.rejects(()=>service.handle({action:'deleteAccount',uid:'shared-teacher',confirmation:'DELETE'},caller,true,false),e=>e.code==='failed-precondition');
});
test('unverified accounts cannot use messaging; message payloads are bounded',async()=>{
 await assert.rejects(()=>service.handle({action:'getMessages'}, {...caller,token:{email_verified:false}},false,false),e=>e.code==='permission-denied');
 for(const body of ['', 'x'.repeat(4001)])await assert.rejects(()=>service.handle({action:'sendMessage',body,requestId:'test-request-12345'},caller,false,false),e=>e.code==='invalid-argument');
});
test('directory and conversations render untrusted strings as text',()=>{
 const user={id:'u',name:'<img src=x onerror=bad>',email:'<script>bad</script>'};
 const output=[directoryRows([user],{owner:false,self:'other',modules:[],attempts:[]}),messageView({user,items:[{body:'<svg onload=bad>',from:'user'}],teacher:true,exists:true}),deletionView(user,{self:false,google:true})].join('');
 assert.ok(!output.includes('<img'));assert.ok(!output.includes('<script>bad'));assert.ok(!output.includes('<svg'));assert.ok(output.includes('&lt;'));
});
