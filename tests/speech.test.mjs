import test from 'node:test';
import assert from 'node:assert/strict';
import {speechFeedbackView,toneGuidance} from '../src/speech-view.mjs';
import {createSpeechPlayback} from '../src/speech-playback.mjs';

test('feedback presents target, submitted audio and honest English guidance in order',()=>{
 const html=speechFeedbackView({hanzi:'午',pinyin:'wǔ',meaning:'noon',hint:'Keep the third tone low.'},{provider:'openai',transcript:'五',matched:false},'blob:test');
 assert.ok(html.indexOf('Correct pronunciation')<html.indexOf('<h4>Your recording'));
 assert.ok(html.indexOf('<h4>Your recording')<html.indexOf('What to practise next'));
 assert.match(html,/wǔ/);assert.match(html,/src="blob:test"/);assert.match(html,/cannot tell us which sound or tone/);
 const matched=speechFeedbackView({hanzi:'午',pinyin:'wǔ'},{provider:'openai',transcript:'午',matched:true},'blob:test');
 assert.match(matched,/does not confirm correct tones/);
});

test('tone guidance handles written/numeric tones without guessing joined syllables',()=>{
 assert.equal(toneGuidance('shàng')[0].label,'Tone 4');
 assert.equal(toneGuidance('huan1 ying2')[1].label,'Tone 2');
 assert.equal(toneGuidance('ma5')[0].label,'Neutral tone');
 assert.match(toneGuidance('nǐ hǎo')[0].tip,/another third tone/);
 assert.equal(toneGuidance('huānyíng').length,0);
 assert.equal(toneGuidance('no tone').length,0);
});

test('speech feedback escapes lecturer/provider text and preserves null scores',()=>{
 const html=speechFeedbackView({hanzi:'<img>',pinyin:'"bad',hint:'<script>x</script>'},{provider:'azure',transcript:'<svg>',accuracy:0,fluency:null,completeness:100,words:[{word:'<img>',error:'Mispronunciation'}]},'blob:test');
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img>'));assert.match(html,/&lt;svg&gt;/);
 assert.match(html,/<strong>0<\/strong>/);assert.match(html,/<strong>—<\/strong>/);
});

function fixture(voices=[{lang:'zh-CN'}]){
 const utterances=[],events=[];
 const synthesis={getVoices:()=>voices,cancel:()=>{},speak:u=>utterances.push(u)};
 const player={currentTime:5,play:async()=>{events.push('recording');},pause:()=>events.push('paused')};
 const playback=createSpeechPlayback({synthesis,Utterance:class{constructor(text){this.text=text;}},status:s=>events.push(s)});
 return {playback,player,utterances,events};
}
test('comparison plays the model before the exact learner recording',async()=>{
 const f=fixture(),promise=f.playback.compare('午',f.player);
 assert.equal(f.utterances[0].text,'午');assert.ok(!f.events.includes('recording'));
 f.utterances[0].onend();await promise;assert.ok(f.events.includes('recording'));assert.equal(f.player.currentTime,0);
 f.player.onended();assert.match(f.events.at(-1),/^3/);
});
test('leaving/changing a recording cancels pending model playback without playing stale audio',async()=>{
 const f=fixture(),promise=f.playback.compare('午',f.player);f.playback.stop();f.utterances[0].onend();await promise;
 assert.ok(!f.events.includes('recording'));
});
test('blocked autoplay leaves an actionable manual playback prompt',async()=>{
 const f=fixture();f.player.play=async()=>{throw Error('NotAllowedError');};await f.playback.replay(f.player);
 assert.match(f.events.at(-1),/Tap play in Your recording/);
});
test('missing Mandarin voice gives a useful fallback and never selects Cantonese',async()=>{
 const f=fixture([{lang:'zh-HK'}]);await assert.rejects(()=>f.playback.model('午'),/No Mandarin voice/);
 assert.equal(f.utterances.length,0);
});
test('server model audio finishes before the learner recording starts',async()=>{
 let played=false,modelStarted=false;
 const model={currentTime:0,pause(){},play:async()=>{modelStarted=true;}},learner={currentTime:0,pause(){},play:async()=>{played=true;}};
 const controller=createSpeechPlayback({getModel:async()=>model});
 const result=controller.compare('午',learner);await new Promise(r=>setImmediate(r));assert.equal(modelStarted,true);assert.equal(played,false);
 model.onended();await result;assert.equal(played,true);
});
test('late server model response cannot restart audio after navigation',async()=>{
 let finish,played=false;const controller=createSpeechPlayback({getModel:()=>new Promise(r=>finish=r)});
 const result=controller.model('午');controller.stop();finish({play:async()=>{played=true;}});assert.equal(await result,false);assert.equal(played,false);
});
