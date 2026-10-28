import test from 'node:test';import assert from 'node:assert/strict';
import model from '../_chinese-firebase/functions/model-audio.js';
function fixture(){
 const values=new Map([['lessons/beginner-01',{published:true,speaking:true,vocabulary:[{id:'word-1',hanzi:'午',pinyin:'wǔ'}]}],['settings/public',{speechProvider:'openai',openaiConfigured:true}]]);
 const doc=path=>({path,get:async()=>({data:()=>values.get(path)}),set:async value=>values.set(path,value),delete:async()=>values.delete(path)});
 const db={doc,runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>values.set(r.path,v)})};
 let calls=0,charged=0;const run=model.createPronunciation(db,async()=>({key:'synthetic'}),async()=>{charged++;},async(_,word)=>{assert.equal(word.hanzi,'午');calls++;return 'test-base64';});
 return {run,values,counts:()=>({calls,charged})};
}
const request={lessonId:'beginner-01',wordId:'word-1'},user={uid:'learner',token:{email_verified:true}};
test('pronunciation endpoint checks verification, published exercise and enabled provider',async()=>{
 const f=fixture();await assert.rejects(()=>f.run(request,{...user,token:{}},false),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.run({...request,wordId:'arbitrary text'},user,false),e=>e.code==='failed-precondition');
 f.values.get('lessons/beginner-01').published=false;await assert.rejects(()=>f.run(request,user,false),e=>e.code==='failed-precondition');
 f.values.get('lessons/beginner-01').published=true;f.values.get('settings/public').speechProvider='off';await assert.rejects(()=>f.run(request,user,false),e=>e.code==='failed-precondition');
 assert.deepEqual(f.counts(),{calls:0,charged:0});
});
test('pronunciation cache shares one generation and changes when the lecturer changes pinyin',async()=>{
 const f=fixture();await f.run(request,user,false);await f.run(request,{...user,uid:'other'},false);assert.deepEqual(f.counts(),{calls:1,charged:1});
 f.values.get('lessons/beginner-01').vocabulary[0].pinyin='wu3';await f.run(request,user,false);assert.deepEqual(f.counts(),{calls:2,charged:2});
});
test('model PCM is wrapped as browser-playable 24 kHz mono WAV',()=>{
 const result=model.wav(Buffer.alloc(24000));assert.equal(result.toString('ascii',0,4),'RIFF');assert.equal(result.readUInt32LE(24),24000);assert.equal(result.readUInt16LE(22),1);assert.equal(result.readUInt32LE(40),24000);assert.equal(result.length,24044);
});
