import test from 'node:test';
import assert from 'node:assert/strict';
import feedback from '../_chinese-firebase/functions/feedback.js';
import {feedbackForm} from '../src/site-feedback.mjs';
const valid={body:'A suggestion',requestId:'test-feedback-123456',page:'/chinese/#module=beginner'};
const jpeg={data:'data:image/jpeg;base64,/9j/2Q=='};
test('feedback accepts text, screenshots, or both; contact is optional',()=>{
 assert.equal(feedback.validateFeedback(valid).body,'A suggestion');
 assert.equal(feedback.validateFeedback({...valid,body:'',images:[jpeg]}).images.length,1);
 assert.equal(feedback.validateFeedback({...valid,images:[jpeg]}).images.length,1);
});
test('feedback rejects empty, oversized, malformed and executable attachments',()=>{
 for(const change of [{body:''},{body:'x'.repeat(5001)},{email:'bad-address'},{images:Array(6).fill(jpeg)},{images:[{data:'data:image/svg+xml;base64,PHN2Zz4='}]},{images:[{data:'data:image/jpeg;base64,aGVsbG8='}]},{page:'https://evil.example/'},{requestId:'../bad'}])assert.throws(()=>feedback.validateFeedback({...valid,...change}));
});
test('feedback contact fields escape account strings',()=>{
 const html=feedbackForm({displayName:'"><script>alert(1)</script>',email:'"><img src=x>'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x>'));
});
function memoryDb(){const rows=new Map();const ref=path=>({path,collection:name=>({doc:id=>ref(`${path}/${name}/${id}`)})});return {rows,doc:ref,runTransaction:async fn=>fn({get:async r=>({exists:rows.has(r.path),data:()=>rows.get(r.path)}),create:(r,v)=>rows.set(r.path,v),set:(r,v)=>rows.set(r.path,v)})};}
test('guest feedback stores images privately and retries do not duplicate submissions',async()=>{
 const db=memoryDb(),service=feedback.createFeedback(db),req={rawRequest:{ip:'192.0.2.1'}};
 const first=await service.submit({...valid,images:[jpeg]},req),again=await service.submit({...valid,images:[jpeg]},req);
 assert.equal(first.id,again.id);assert.equal(db.rows.size,4);
 assert.equal(db.rows.get(`siteFeedback/${first.id}`).imageCount,1);
 assert.ok(db.rows.has(`siteFeedback/${first.id}/images/0`));
 assert.ok(!JSON.stringify([...db.rows]).includes('192.0.2.1'));
});
test('guest and learner cannot read or close feedback; daily limits reject new writes',async()=>{
 const db=memoryDb(),service=feedback.createFeedback(db);
 for(const action of ['listFeedback','getFeedback','setFeedbackStatus'])await assert.rejects(()=>service.handle({action},false),e=>e.code==='permission-denied');
 db.runTransaction=async fn=>fn({get:async r=>({exists:false,data:()=>r.path.startsWith('feedbackUsage/')?{count:200}:undefined})});
 await assert.rejects(()=>service.submit(valid,{rawRequest:{ip:'192.0.2.1'}}),e=>e.code==='resource-exhausted');
 assert.equal(db.rows.size,0);
});
