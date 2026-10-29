const {HttpsError}=require('firebase-functions/v2/https');
const {MODULES}=require('./validation');
function bucket(){return {attempts:0,writing:{attempts:0,noRetry:0,retries:0},pinyin:{attempts:0,correct:0},speaking:{reviews:0,recognized:0,recognitionChecks:0,accuracyTotal:0,accuracyChecks:0}};}
function addAttempt(b,a){
 if(a.kind==='writing'){b.attempts++;b.writing.attempts++;const n=Number.isFinite(a.mistakes)?Math.max(0,a.mistakes):0;b.writing.retries+=n;if(n===0)b.writing.noRetry++;}
 if(a.kind==='pinyin'){b.attempts++;b.pinyin.attempts++;if(a.correct===true)b.pinyin.correct++;}
 // Old speaking attempt.correct means completion, not pronunciation success.
}
function addSpeech(b,a){b.attempts++;b.speaking.reviews++;const r=a.result||{};if(r.provider==='openai'&&typeof r.matched==='boolean'){b.speaking.recognitionChecks++;if(r.matched)b.speaking.recognized++;}if(r.provider==='azure'&&typeof r.accuracy==='number'&&Number.isFinite(r.accuracy)){b.speaking.accuracyChecks++;b.speaking.accuracyTotal+=Math.max(0,Math.min(100,r.accuracy));}}
function finish(b){return {...b,writing:{...b.writing,rate:b.writing.attempts?Math.round(100*b.writing.noRetry/b.writing.attempts):null,averageRetries:b.writing.attempts?Math.round(10*b.writing.retries/b.writing.attempts)/10:null},pinyin:{...b.pinyin,rate:b.pinyin.attempts?Math.round(100*b.pinyin.correct/b.pinyin.attempts):null},speaking:{...b.speaking,recognitionRate:b.speaking.recognitionChecks?Math.round(100*b.speaking.recognized/b.speaking.recognitionChecks):null,averageAccuracy:b.speaking.accuracyChecks?Math.round(b.speaking.accuracyTotal/b.speaking.accuracyChecks):null}};}
function summarize(moduleId,attempts,reviews){
 const total=bucket(),weeks=Array.from({length:12},(_,i)=>({week:i+1,...bucket()})),focus=new Map();
 const weekOf=a=>{const m=new RegExp(`^${moduleId}-(\\d{2})$`).exec(a.lessonId||'');const w=Number(m?.[1]);return w>=1&&w<=12?w:0;};
 const addFocus=(a,week,weight)=>{if(weight>0&&a.hanzi){const key=week+':'+a.hanzi,old=focus.get(key)||{week,hanzi:a.hanzi,retries:0};old.retries+=weight;focus.set(key,old);}};
 for(const a of attempts){const week=weekOf(a);if(!week||a.moduleId!==moduleId)continue;addAttempt(total,a);addAttempt(weeks[week-1],a);addFocus(a,week,a.kind==='writing'?a.mistakes:a.kind==='pinyin'&&!a.correct?1:0);}
 for(const a of reviews){const week=weekOf(a);if(!week)continue;addSpeech(total,a);addSpeech(weeks[week-1],a);addFocus(a,week,a.result?.matched===false?1:0);}
 return {moduleId,total:finish(total),weeks:weeks.map(finish),focus:[...focus.values()].sort((a,b)=>b.retries-a.retries).slice(0,5)};
}
function createPerformance(db){return async(d,caller)=>{
 if(!MODULES.includes(d.moduleId))throw new HttpsError('invalid-argument','Choose a module.');
 const [attempts,reviews,enrollment,profile]=await Promise.all([db.collection('attempts').where('uid','==',caller.uid).where('moduleId','==',d.moduleId).get(),db.collection('speechFeedback').where('uid','==',caller.uid).get(),db.doc(`enrollments/${caller.uid}`).get(),db.doc(`users/${caller.uid}`).get()]);
 return {...summarize(d.moduleId,attempts.docs.map(x=>x.data()),reviews.docs.map(x=>x.data())),moduleIds:enrollment.data()?.modules||[profile.data()?.moduleId||'beginner']};
};}
module.exports={summarize,createPerformance};
