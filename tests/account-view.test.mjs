import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarSource,accountMenu,accountSettings} from '../src/account-view.mjs';
import accounts from '../_chinese-firebase/functions/accounts.js';
const user={uid:'teacher',displayName:'<script>test</script>',email:'teacher@example.invalid',photoURL:'https://example.org/avatar.jpg'};
test('avatar prefers uploads, falls back to Google, and rejects unsafe sources',()=>{
 assert.equal(avatarSource(user,{photo:'data:image/jpeg;base64,/9j/2Q=='}),'data:image/jpeg;base64,/9j/2Q==');
 assert.equal(avatarSource(user,{}),user.photoURL);
 assert.equal(avatarSource({photoURL:'javascript:alert(1)'},{}),'');
 assert.equal(avatarSource({...user,photoURL:null,providerData:[{providerId:'google.com',photoURL:'https://example.org/google.jpg'}]},{}),'https://example.org/google.jpg');
});
test('account dropdown highlights sign out and keeps deletion inside account settings',()=>{
 const menu=accountMenu(user,{},{}),settings=accountSettings(user,{},{});
 assert.ok(menu.includes('account-signout'));assert.ok(menu.includes('Sign out'));
 assert.ok(!menu.includes('delete-self'));assert.ok(!menu.includes('<script>'));
 assert.ok(settings.includes('<details class="account-removal">'));assert.ok(settings.includes('data-action="delete-self"'));
 assert.ok(!menu.includes('/chinese/admin/'));assert.ok(accountMenu(user,{}, {teacher:true}).includes('/chinese/admin/'));
});
test('teachers may queue deletion of peers and students, but never the administrator',async()=>{
 const orders=[];
 const db={doc:path=>({path,get:async()=>({exists:false})}),runTransaction:async fn=>fn({get:async()=>({exists:false}),create:(ref,value)=>orders.push({ref,value})})};
 const service=accounts.createAccounts(db,{getUser:async id=>({uid:id,email:id==='owner'?'kstouras@gmail.com':id+'@example.invalid'})});
 const caller={uid:'teacher',token:{auth_time:Math.floor(Date.now()/1000),email_verified:true}};
 for(const target of ['peer-teacher','student'])assert.equal((await service.handle({action:'deleteAccount',uid:target,confirmation:'DELETE'},caller,false,false,true)).queued,true);
 assert.equal(orders.length,2);
 await assert.rejects(()=>service.handle({action:'deleteAccount',uid:'owner',confirmation:'DELETE'},caller,false,false,true),e=>e.code==='permission-denied');
 await assert.rejects(()=>service.handle({action:'deleteAccount',uid:'student',confirmation:'DELETE'},caller,false,false,false),e=>e.code==='permission-denied');
 await assert.rejects(()=>service.handle({action:'deleteAccount',uid:'student',confirmation:'wrong'},caller,false,false,true),e=>e.code==='invalid-argument');
});
