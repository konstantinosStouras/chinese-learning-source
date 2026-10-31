// Compare what a transcriber heard with the lesson word by sound, not by exact characters.
// A single Mandarin syllable has many homophones (午 / 五 / 舞 are all wǔ), so a correct
// recording is often written down as a different character. Scoring by pinyin fixes that.
const {pinyin}=require('pinyin-pro');
const {normalizePinyin}=require('./practice-core');
const han=text=>String(text||'').normalize('NFKC').replace(/[^\p{Script=Han}]/gu,'');
const syllable=s=>normalizePinyin(s).replace(/0$/,'');
const base=s=>s.replace(/[1-4]$/,'');
function heardSyllables(transcript){
 const characters=han(transcript);
 if(characters)return pinyin(characters,{toneType:'num',type:'array'}).map(syllable).filter(Boolean);
 // Some transcripts are written in pinyin or Latin letters, e.g. "wu" or "wǔ".
 return String(transcript||'').normalize('NFC').toLowerCase().split(/[\s\p{P}]+/u).map(syllable).filter(s=>/^[a-z]/.test(s));
}
function targetSyllables(word){
 const characters=han(word.hanzi),fromTeacher=String(word.pinyin||'').normalize('NFC').split(/[\s'’\-]+/).filter(Boolean).map(syllable).filter(Boolean);
 // The lecturer's pinyin is authoritative when it gives one syllable per character (e.g. 行 as xíng or háng).
 if(fromTeacher.length&&fromTeacher.length===[...characters].length)return fromTeacher;
 return characters?pinyin(characters,{toneType:'num',type:'array'}).map(syllable).filter(Boolean):fromTeacher;
}
// Longest common subsequence over toneless syllables; among equal sound matches prefer more tone matches.
function align(heard,target){
 const better=(a,b)=>a[0]>b[0]||(a[0]===b[0]&&a[1]>b[1])?a:b;
 let row=Array.from({length:target.length+1},()=>[0,0]);
 for(const h of heard){const next=[[0,0]];for(let j=1;j<=target.length;j++){const t=target[j-1];let best=better(row[j],next[j-1]);if(base(h)===base(t))best=better(best,[row[j-1][0]+1,row[j-1][1]+(h===t?1:0)]);next[j]=best;}row=next;}
 return row[target.length];
}
function display(transcript){const characters=han(transcript);return characters?pinyin(characters,{type:'array'}).join(' '):String(transcript||'').trim();}
// The whole word must be heard as one contiguous run of syllables; the window with the most tone matches wins.
function contiguous(heard,target){
 let best=null;
 for(let i=0;target.length&&i+target.length<=heard.length;i++){const run=heard.slice(i,i+target.length);if(run.every((s,k)=>base(s)===base(target[k]))){const tones=run.filter((s,k)=>s===target[k]).length;if(best===null||tones>best)best=tones;}}
 return best;
}
function matchSpeech(transcript,word){
 const target=targetSyllables(word),characters=han(transcript),targetCharacters=han(word.hanzi),at=targetCharacters?characters.indexOf(targetCharacters):-1;
 // When the exact target characters were written, read them with the lecturer's pinyin (e.g. 行 as háng, not xíng).
 const heard=at>=0?[...heardSyllables(characters.slice(0,at)),...target,...heardSyllables(characters.slice(at+targetCharacters.length))]:heardSyllables(transcript);
 const partial=align(heard,target),run=contiguous(heard,target);
 const extra=Math.max(0,heard.length-target.length),allSounds=run!==null;
 const recognised=allSounds&&extra<=Math.max(1,Math.ceil(target.length/2));
 const soundMatches=allSounds?target.length:partial[0],toneMatches=allSounds?run:partial[1],toneMatched=recognised&&toneMatches===target.length;
 const score=recognised?(toneMatched?10:8):allSounds?6:target.length?Math.round(60*soundMatches/target.length)/10:0;
 return {recognised,toneMatched,score,syllables:target.length,soundMatches,toneMatches,extra,heard:display(transcript),target:String(word.pinyin||'').trim(),homophone:recognised&&!!han(transcript)&&han(transcript)!==han(word.hanzi)};
}
module.exports={matchSpeech,heardSyllables,targetSyllables};
