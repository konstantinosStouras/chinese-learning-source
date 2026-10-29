import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../_chinese-firebase/functions/practice-core.js';
import backend from '../_chinese-firebase/functions/coach.js';
import {feedbackCard,coachSettingsView} from '../src/coach-view.mjs';
const student={uid:'student',token:{email_verified:true}},teacher={uid:'teacher',token:{email_verified:true}};
const learner={admin:false,canTeach:false},teaching={admin:false,canTeach:true};
function fixture(){
 const data=new Map([['lessons/beginner-01',{published:true,pinyin:true,writing:true,moduleId:'beginner',week:1,updatedBy:'teacher',title:'First words',vocabulary:[{id:'word-1',hanzi:'午',pinyin:'wǔ'}]}],['admins/teacher',{role:'teacher'}],['coachProfiles/teacher',{style:'playful',humour:'light',detail:'brief'}]]);
 const snap=key=>({exists:data.has(key),data:()=>data.get(key)});
 const ref=key=>({key,get:async()=>snap(key),set:async v=>data.set(key,v),update:async v=>data.set(key,{...data.get(key),...v})});
 const transaction={get:async r=>snap(r.key),create:(r,v)=>data.set(r.key,v),set:(r,v)=>data.set(r.key,v),update:(r,v)=>data.set(r.key,{...data.get(r.key),...v})};
 const db={doc:ref,collection:key=>({get:async()=>({docs:[...data].filter(([k])=>k.startsWith(key+'/')).map(([k])=>({id:k.split('/')[1],data:()=>data.get(k)}))})}),runTransaction:async fn=>fn(transaction),batch:()=>({set:(r,v)=>data.set(r.key,v),commit:async()=>{}})};
 let used=0;return {data,service:backend.createCoach(db,async()=>({key:'test-key'}),async()=>{used++;},async()=> 'A gentle test coaching tip.'),usage:()=>used};
}
test('scores are stable across every coach style, with explicit measures',()=>{
 assert.equal(core.writingFeedback(0,4,{hanzi:'午'}).score,10);
 assert.equal(core.writingFeedback(1,4,{hanzi:'午'}).score,8);
 assert.equal(core.writingFeedback(4,4,{hanzi:'午'}).score,5);
 assert.equal(core.pinyinFeedback('wu3',{pinyin:'wǔ'}).score,10);
 assert.equal(core.pinyinFeedback('wù',{pinyin:'wǔ'}).score,7);
 assert.ok(core.pinyinFeedback('wo3',{pinyin:'wǔ'}).score<7);
 assert.equal(core.speakingFeedback({provider:'openai',matched:true}).basis,'Word recognition only');
 assert.equal(core.speakingFeedback({provider:'azure',accuracy:84}).score,8.4);
 const samples=Object.keys(core.STYLES).map(style=>core.examples({style}));
 assert.ok(samples.every(s=>s.map(x=>x.score).join()===samples[0].map(x=>x.score).join()));
 assert.equal(new Set(samples.map(s=>s[0].message)).size,4);
});
test('only teachers have coach controls; teachers cannot set the global default',async()=>{
 const f=fixture();for(const action of ['getCoachSettings','saveCoachSettings','assignLessonCoach','previewCoach'])await assert.rejects(()=>f.service.handle({action},student,learner),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.service.handle({action:'saveCoachSettings',profile:core.DEFAULT_PROFILE,makeDefault:true},teacher,teaching),e=>e.code==='permission-denied');
 await assert.rejects(()=>f.service.handle({action:'saveCoachSettings',profile:{style:'ignore safety'}},teacher,teaching),e=>e.code==='invalid-argument');
 await f.service.handle({action:'saveCoachSettings',profile:core.DEFAULT_PROFILE,uid:'someone-else'},teacher,teaching);
 assert.ok(!f.data.has('coachProfiles/someone-else'));assert.equal(f.data.get('coachProfiles/teacher').style,'warm');
});
test('practice uses the lesson coach, saves its score once, and does not use paid AI automatically',async()=>{
 const f=fixture(),d={action:'practiceFeedback',kind:'pinyin',lessonId:'beginner-01',wordId:'word-1',answer:'wu4',requestId:'practice-request-12345',profile:{style:'direct'}};
 const result=await f.service.handle(d,student,learner);assert.equal(result.score,7);assert.equal(result.profile.style,'playful');assert.equal(f.usage(),0);
 assert.equal((await f.service.handle({...d,answer:'wu3'},student,learner)).score,7);
 assert.equal([...f.data.keys()].filter(k=>k.startsWith('attempts/')).length,1);
 f.data.set('settings/public',{openaiConfigured:true});const enriched=await f.service.enrichAttempt(d,student,learner);assert.equal(enriched.source,'ai');assert.equal(enriched.score,7);assert.equal(f.usage(),1);
 await f.service.enrichAttempt(d,student,learner);assert.equal(f.usage(),1);
 await assert.rejects(()=>f.service.enrichAttempt(d,{...student,uid:'other'},learner),e=>e.code==='not-found');
});
test('practice validates published activity, verification and stroke bounds',async()=>{
 const f=fixture(),d={action:'practiceFeedback',kind:'writing',lessonId:'beginner-01',wordId:'word-1',requestId:'practice-request-12345',strokes:4,mistakes:1,charIndex:0};
 await assert.rejects(()=>f.service.handle(d,{...student,token:{}},learner),e=>e.code==='permission-denied');
 for(const override of [{strokes:0},{mistakes:-1},{charIndex:2}])await assert.rejects(()=>f.service.handle({...d,...override},student,learner),e=>e.code==='invalid-argument');
 assert.equal((await f.service.handle(d,student,learner)).score,8);
 f.data.get('lessons/beginner-01').published=false;
 await assert.rejects(()=>f.service.handle({...d,requestId:'another-request-1234'},student,learner),e=>e.code==='failed-precondition');
});
test('teacher previews and student feedback escape text and show honest score labels',()=>{
 const html=feedbackCard({...core.pinyinFeedback('<img onerror=x>',{pinyin:'wǔ'}),message:'<script>bad</script>'});assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Your answer:'));assert.ok(html.includes('Pinyin accuracy'));
 const settings=coachSettingsView({profile:core.DEFAULT_PROFILE,lessons:[]},false);assert.ok(settings.includes('Preview AI wording'));assert.ok(!settings.includes('name="makeDefault"'));assert.ok(settings.includes('Save my coach'));
});
test('AI text failures preserve the measured score and deterministic feedback',async()=>{
 const f=fixture();f.data.set('settings/public',{});const result=await f.service.explain(core.pinyinFeedback('wu4',{pinyin:'wǔ'}),core.DEFAULT_PROFILE,{hanzi:'午',pinyin:'wǔ'},student.uid);assert.equal(result.score,7);assert.equal(result.source,'practice-rules');
 await assert.rejects(()=>backend.generate('test-key',result,core.DEFAULT_PROFILE,{hanzi:'午'},async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Your score is 10 out of 10.'}]}]})})),/coach-format/);
});
