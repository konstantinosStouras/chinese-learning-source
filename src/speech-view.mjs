import {escapeHtml as e} from './core.mjs';

// Describe the target's written tones, never infer a learner's tone from transcription.
export function toneGuidance(pinyin){
 const groups=['āēīōūǖ','áéíóúǘ','ǎěǐǒǔǚ','àèìòùǜ'];
 const descriptions=['Keep your pitch high and steady.','Let your pitch rise from middle to high.','Keep your pitch low; when saying the syllable on its own, dip and then rise.','Start high and let your pitch fall firmly.'];
 const syllables=String(pinyin||'').normalize('NFC').split(/[\s’'\-]+/).filter(Boolean);
 return syllables.flatMap((syllable,i)=>{
  const marks=[...syllable].map(c=>groups.findIndex(g=>g.includes(c.toLowerCase()))+1).filter(Boolean);
  const numeric=syllable.match(/([1-5])$/);
  // Joined syllables without separators are ambiguous; use the lecturer's hint instead.
  if(marks.length>1)return [];
  const tone=numeric?Number(numeric[1]):marks[0];
  if(!tone)return [];
  let tip=tone===5?'Keep this syllable light and short.':descriptions[tone-1];
  if(tone===3&&syllables.length>1)tip='Keep this syllable low in connected speech. Before another third tone, it changes to a rising tone; follow the whole-word model.';
  return [{syllable,label:tone===5?'Neutral tone':`Tone ${tone}`,tip}];
 });
}

export function speechFeedbackView(word,result,url){
 const issues=(result.words||[]).filter(w=>w.error&&w.error!=='None');
 const guidance=toneGuidance(word.pinyin);
 const assessment=result.provider==='azure';
 const message=assessment
  ? (issues.length?'The speech service flagged parts of this attempt. Compare the highlighted words with the model, then record another try.':'Compare the model with your recording, one syllable at a time. Use the practice guide below for your next attempt.')
  : !result.transcript?'No clear words were recognised. Try a quieter place, move a little closer to the microphone, and say the full word once.'
    : result.matched?'The recognised words match the target. Now compare the sounds and pitch in your recording with the model. A matching transcript does not confirm correct tones.'
    : 'The recognised words differ from the target. Listen to the model, say the pinyin slowly, then try the full word again. Recognition alone cannot tell us which sound or tone you need to change.';
 return `<section class="speech-review" aria-label="Your pronunciation feedback"><div class="speech-review-heading"><div><span class="green-label">LISTEN. COMPARE. TRY AGAIN.</span><h3>Your speaking feedback</h3></div><button class="btn primary small" data-action="compare-voice">Play model, then my voice</button><button class="btn small" data-action="stop-voice">Stop audio</button></div><p id="comparison-status" class="small muted" role="status">Follow the three steps below.</p>
 <ol class="speech-steps">
 <li class="speech-step"><span class="speech-step-number" aria-hidden="true">1</span><div><h4>Correct pronunciation</h4><div class="speech-target"><span lang="zh-CN" class="speech-target-hanzi">${e(word.hanzi)}</span><div><strong class="speech-target-pinyin" lang="zh-Latn">${e(word.pinyin)}</strong><span>${e(word.meaning)}</span></div></div><p class="small muted">Pinyin is the spelling of the sounds. Its tone marks show how your pitch moves.</p><button class="btn small" data-action="listen">Listen to the correct pronunciation</button><div id="model-audio-output"></div></div></li>
 <li class="speech-step"><span class="speech-step-number" aria-hidden="true">2</span><div><h4>Your recording</h4><p class="small muted">Listen to the exact attempt you just submitted.</p><audio id="feedback-recording" class="audio-player" controls preload="metadata" src="${e(url)}" aria-label="Replay your submitted pronunciation"></audio></div></li>
 <li class="speech-step"><span class="speech-step-number" aria-hidden="true">3</span><div><h4>What to practise next</h4><p>${e(message)}</p><p class="speech-heard"><strong>Recognised words:</strong> <span lang="zh-CN">${e(result.transcript||'No speech detected')}</span></p>${issues.length?`<p><strong>Words to revisit:</strong> ${issues.map(w=>`<span lang="zh-CN">${e(w.word)}</span>`).join('、')}</p>`:''}
 ${word.hint||result.hint?`<div class="speech-teacher-tip"><strong>Teaching tip</strong><p>${e(word.hint||result.hint)}</p></div>`:''}
 ${guidance.length?`<div class="tone-guidance"><h5>How to say the target</h5>${guidance.map(t=>`<p><strong lang="zh-Latn">${e(t.syllable)}</strong> <span class="tone-label">${e(t.label)}</span><br>${e(t.tip)}</p>`).join('')}<p class="small muted">This describes the target pronunciation, not a measured error in your recording. Tones can change when syllables are joined.</p></div>`:''}
 ${assessment?`<div class="scores">${[['Accuracy',result.accuracy],['Fluency',result.fluency],['Completeness',result.completeness]].map(([label,value])=>`<div class="score"><strong>${Number.isFinite(value)?Math.round(value):'—'}</strong><span>${label}</span></div>`).join('')}</div>`:''}
 <p class="small muted">${e(result.notice||'Practice feedback, not an assessed grade.')}</p><button class="btn small" data-action="record">Record another try</button></div></li></ol></section>`;
}
