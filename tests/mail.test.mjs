import test from 'node:test';import assert from 'node:assert/strict';
import mail from '../_chinese-firebase/functions/mail.js';
function fixture({verified=true,preference=true,enabled=true,from='admin',deleted=false}={}){
 const path='threads/learner/items/message';const values=new Map([[path,{from,notifyEmail:from==='admin',mailStatus:'pending'}],['settings/public',{mailEnabled:enabled}],['users/learner',{firstName:'Mei <test>',emailNotifications:preference}]]);
 if(deleted)values.set('accountDeletions/learner',{status:'requested'});
 const ref=p=>({path:p,parent:{parent:{id:'learner'}},get:async()=>({exists:values.has(p),data:()=>values.get(p)})});
 const db={doc:ref,runTransaction:async fn=>fn({get:r=>r.get(),update:(r,d)=>{assert.ok(values.has(r.path),'must not recreate deleted data');values.set(r.path,{...values.get(r.path),...d});}})};
 const sent=[];let failures=0;const notify=mail.createMailer(db,{getUser:async()=>({email:'learner@example.com',emailVerified:verified})},async()=>'synthetic-app-password',()=>({sendMail:async msg=>{if(failures-->0)throw Error('SMTP failed');sent.push(msg);return {accepted:['learner@example.com']};},close(){}}));
 return {values,sent,run:()=>notify(ref(path)),fail:()=>failures++,state:()=>values.get(path)};
}
test('admin notifications contain a safe reply link and send once on repeated events',async()=>{const f=fixture();await f.run();await f.run();assert.equal(f.sent.length,1);assert.equal(f.state().mailStatus,'sent');assert.equal(f.sent[0].from,'Chinese Practice <kstouras@gmail.com>');assert.match(f.sent[0].text,/https:\/\/www.stouras.com\/chinese\/#messages/);assert.match(f.sent[0].html,/Mei &lt;test&gt;/);});
test('replies, opt-outs, unverified and deleted accounts do not receive emails',async()=>{for(const options of [{from:'user'},{preference:false},{verified:false},{deleted:true},{enabled:false}]){const f=fixture(options);await f.run();assert.equal(f.sent.length,0);}});
test('temporary SMTP failure retries without losing the message',async()=>{const f=fixture();f.fail();await assert.rejects(f.run);assert.equal(f.state().mailStatus,'retrying');await f.run();assert.equal(f.sent.length,1);assert.equal(f.state().mailStatus,'sent');});
test('email delivery failures stop after five attempts',async()=>{const f=fixture();for(let i=0;i<5;i++){f.fail();await assert.rejects(f.run);}await f.run();assert.equal(f.state().mailStatus,'failed');assert.equal(f.state().mailAttempts,5);});
