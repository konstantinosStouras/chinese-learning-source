import test from 'node:test';
import assert from 'node:assert/strict';
import {matchSpeech} from '../_chinese-firebase/functions/speech-match.js';

const wu={hanzi:'午',pinyin:'wǔ'},nihao={hanzi:'你好',pinyin:'nǐ hǎo'};
test('a correct single syllable scores 10 even when transcribed as a homophone',()=>{
 for(const heard of ['午','五','五。','舞','wǔ'])assert.equal(matchSpeech(heard,wu).score,10,heard);
 const m=matchSpeech('五',wu);assert.equal(m.recognised,true);assert.equal(m.homophone,true);assert.equal(m.heard,'wǔ');
 assert.equal(matchSpeech('午',wu).homophone,false);
});
test('same syllable with a different tone is recognised with a tone hint, not a zero',()=>{
 const m=matchSpeech('无',wu);assert.equal(m.score,8);assert.equal(m.recognised,true);assert.equal(m.toneMatched,false);assert.equal(m.heard,'wú');
 assert.equal(matchSpeech('Wu',wu).score,8);
});
test('different, partial or padded words get partial credit or zero',()=>{
 assert.equal(matchSpeech('二',wu).score,0);assert.equal(matchSpeech('',wu).score,0);assert.equal(matchSpeech('',wu).recognised,false);
 assert.equal(matchSpeech('你好',wu).score,0);
 assert.equal(matchSpeech('午午',wu).score,10);
 const padded=matchSpeech('我说午',wu);assert.equal(padded.score,6);assert.equal(padded.recognised,false);assert.equal(padded.extra,2);
 assert.equal(matchSpeech('你',nihao).score,3);assert.equal(matchSpeech('好你',nihao).score,3);
 assert.equal(matchSpeech('你很好',nihao).recognised,false);
 assert.equal(matchSpeech('再见',nihao).score,0);
});
test('multi-syllable words accept punctuation and homophones and respect the lecturer pinyin',()=>{
 assert.equal(matchSpeech('你好！',nihao).score,10);assert.equal(matchSpeech('泥好',nihao).score,8);
 assert.equal(matchSpeech('银行',{hanzi:'银行',pinyin:'yínháng'}).score,10);
 assert.equal(matchSpeech('行',{hanzi:'行',pinyin:'háng'}).score,10);
 assert.equal(matchSpeech('航',{hanzi:'行',pinyin:'háng'}).score,10);
 assert.equal(matchSpeech('行',{hanzi:'行',pinyin:'xíng'}).score,10);
 assert.equal(matchSpeech('我去银行',{hanzi:'银行',pinyin:'yínháng'}).score,6);
 assert.equal(matchSpeech('<script>五</script>',wu).score,10);
});
