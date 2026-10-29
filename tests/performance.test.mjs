import test from 'node:test';
import assert from 'node:assert/strict';
import performance from '../_chinese-firebase/functions/performance.js';
import {performanceView} from '../src/performance-view.mjs';
test('module averages are weighted across attempts, while weeks and modules remain separate',()=>{
 const attempts=[...Array.from({length:3},()=>({moduleId:'beginner',lessonId:'beginner-01',kind:'pinyin',correct:true})),{moduleId:'beginner',lessonId:'beginner-02',kind:'pinyin',correct:false},{moduleId:'business',lessonId:'business-01',kind:'pinyin',correct:false}];
 const d=performance.summarize('beginner',attempts,[]);
 assert.equal(d.total.pinyin.rate,75);assert.equal(d.total.attempts,4);assert.equal(d.weeks[0].pinyin.rate,100);assert.equal(d.weeks[1].pinyin.rate,0);assert.equal(d.weeks[2].pinyin.rate,null);
});
test('writing measures retries and speaking uses actual reviews, never old completion flags',()=>{
 const d=performance.summarize('beginner',[{moduleId:'beginner',lessonId:'beginner-01',kind:'writing',mistakes:3,hanzi:'午'},{moduleId:'beginner',lessonId:'beginner-01',kind:'writing',mistakes:0},{moduleId:'beginner',lessonId:'beginner-01',kind:'speaking',correct:true}],[{lessonId:'beginner-01',result:{provider:'openai',matched:false},hanzi:'午'},{lessonId:'beginner-01',result:{provider:'openai',matched:true}},{lessonId:'beginner-02',result:{provider:'azure',accuracy:80}},{lessonId:'business-01',result:{provider:'azure',accuracy:5}}]);
 assert.equal(d.total.writing.rate,50);assert.equal(d.total.writing.averageRetries,1.5);assert.equal(d.total.speaking.recognitionRate,50);assert.equal(d.total.speaking.averageAccuracy,80);assert.equal(d.total.attempts,5);assert.equal(d.focus[0].hanzi,'午');
});
test('performance endpoint always queries the caller, ignoring a requested different uid',async()=>{
 const queried=[];const db={collection:name=>{const q={where:(field,op,value)=>{queried.push({name,field,value});return q;},get:async()=>({docs:[]})};return q;},doc:()=>({get:async()=>({data:()=>({moduleId:'beginner'})})})};
 await performance.createPerformance(db)({moduleId:'beginner',uid:'another-user'},{uid:'me'});
 assert.deepEqual(queried.filter(x=>x.field==='uid').map(x=>x.value),['me','me']);
 await assert.rejects(()=>performance.createPerformance(db)({moduleId:'bad'},{uid:'me'}),e=>e.code==='invalid-argument');
});
test('dashboard gives honest empty states and escapes practice data',()=>{
 const d={...performance.summarize('beginner',[],[]),moduleIds:['beginner'],focus:[{week:1,hanzi:'<img src=x>',retries:2}]};
 const html=performanceView(d,'beginner');assert.ok(html.includes('No recorded practice'));assert.ok(html.includes('No attempts yet'));assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('not Mandarin tone accuracy'));
});
