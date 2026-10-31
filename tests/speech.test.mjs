import test from 'node:test';
import assert from 'node:assert/strict';
import {speechFeedbackView,toneGuidance,speakingVerdict} from '../src/speech-view.mjs';
import {createSpeechPlayback} from '../src/speech-playback.mjs';

test('verdict gives actionable recognition feedback without inventing pronunciation scores',()=>{
 const word={hanzi:'你好'};
 assert.equal(speakingVerdict(word,{transcript:'你好！',matched:true}).level,'good');
 assert.equal(speakingVerdict(word,{transcript:'你',matched:false}).level,'close');
 assert.equal(speakingVerdict(word,{transcript:'再见',matched:false}).level,'retry');
 assert.equal(speakingVerdict(word,{transcript:''}).level,'retry');
 assert.equal(speakingVerdict(word,{transcript:'你好',matched:true}).score,undefined);
 assert.equal(speakingVerdict(word,{provider:'azure',accuracy:85}).score,8.5);
 assert.equal(speakingVerdict(word,{provider:'azure',accuracy:0}).score,0);
 assert.equal(speakingVerdict(word,{provider:'azure',accuracy:null}).score,undefined);
 assert.equal(speakingVerdict(word,{provider:'azure',accuracy:65}).level,'close');
});

test('verdict trusts the server sound match so homophones and tone hints are shown honestly',()=>{
 const word={hanzi:'午',pinyin:'wǔ'};
 const same=speakingVerdict(word,{provider:'openai',transcript:'五',matched:true,match:{recognised:true,toneMatched:true,score:10,syllables:1,soundMatches:1,toneMatches:1,extra:0,heard:'wǔ',target:'wǔ',homophone:true}});
 assert.equal(same.level,'good');assert.match(same.detail,/五 \(wǔ\), which sounds the same as 午/);
 const tone=speakingVerdict(word,{provider:'openai',transcript:'无',matched:true,match:{recognised:true,toneMatched:false,score:8,syllables:1,soundMatches:1,toneMatches:0,extra:0,heard:'wú',target:'wǔ',homophone:true}});
 assert.equal(tone.level,'good');assert.match(tone.label,/check the tone/);assert.match(tone.detail,/wú where the target is wǔ/);
 assert.equal(speakingVerdict(word,{provider:'openai',transcript:'我说午',matched:false,match:{recognised:false,toneMatched:false,score:6,syllables:1,soundMatches:1,toneMatches:1,extra:2,heard:'wǒ shuō wǔ',target:'wǔ',homophone:false}}).level,'close');
 assert.equal(speakingVerdict({hanzi:'你好',pinyin:'nǐ hǎo'},{provider:'openai',transcript:'你',matched:false,match:{recognised:false,toneMatched:false,score:3,syllables:2,soundMatches:1,toneMatches:1,extra:0,heard:'nǐ',target:'nǐ hǎo',homophone:false}}).level,'close');
 assert.equal(speakingVerdict(word,{provider:'openai',transcript:'二',matched:false,match:{recognised:false,toneMatched:false,score:0,syllables:1,soundMatches:0,toneMatches:0,extra:0,heard:'èr',target:'wǔ',homophone:false}}).level,'retry');
});

test('feedback presents target, submitted audio and honest English guidance in order',()=>{
 const html=speechFeedbackView({hanzi:'午',pinyin:'wǔ',meaning:'noon',hint:'Keep the third tone low.'},{provider:'openai',transcript:'五',matched:false},'blob:test');
 assert.ok(html.indexOf('Correct pronunciation')<html.indexOf('<h4>Your recording'));
 assert.ok(html.indexOf('<h4>Your recording')<html.indexOf('What to practise next'));
 assert.match(html,/wǔ/);assert.match(html,/src="blob:test"/);assert.match(html,/cannot tell us which sound or tone/);
 const matched=speechFeedbackView({hanzi:'午',pinyin:'wǔ'},{provider:'openai',transcript:'午',matched:true},'blob:test');
 assert.match(matched,/does not confirm correct tones/);
 const homophone=speechFeedbackView({hanzi:'午',pinyin:'wǔ',meaning:'noon'},{provider:'openai',transcript:'五',matched:true,match:{recognised:true,toneMatched:true,score:10,syllables:1,soundMatches:1,toneMatches:1,extra:0,heard:'wǔ',target:'wǔ',homophone:true}},'blob:test');
 assert.match(homophone,/10\.0<small> \/ 10/);assert.match(homophone,/sounds the same as 午/);assert.match(homophone,/Good match/);assert.match(homophone,/homophones such as 五 for 午 count/);
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
