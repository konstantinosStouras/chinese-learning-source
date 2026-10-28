export function createSpeechPlayback({synthesis,Utterance,getModel,status=()=>{}}){
 let generation=0,player=null,cancelPending=null;
 function stop(){generation++;cancelPending?.();cancelPending=null;synthesis?.cancel();if(player){player.pause();player=null;}}
 async function model(text){
  stop();const current=generation;
  const voices=synthesis?.getVoices()||[];
  const voice=voices.find(v=>/^zh[-_]CN/i.test(v.lang))||voices.find(v=>/^zh[-_]SG/i.test(v.lang))||voices.find(v=>/^cmn/i.test(v.lang));
  if(!voice||!Utterance){
   if(!getModel)throw Error('No Mandarin voice is available on this device. Add a Mandarin voice in your language settings; your recording and written guide still work.');
   status('Preparing the Mandarin pronunciation example…');
   let audio;try{audio=await getModel(text);}catch(error){if(current!==generation)return false;throw error;}
   if(current!==generation||!audio)return false;
   player=audio;audio.currentTime=0;status('1 · Listen to the correct pronunciation.');
   return new Promise((resolve,reject)=>{
    cancelPending=()=>resolve(false);
    audio.onended=()=>{if(current!==generation)return;cancelPending=null;player=null;resolve(true);};
    audio.onerror=()=>{if(current!==generation)return;cancelPending=null;player=null;reject(Error('The pronunciation audio could not play. Please try again.'));};
    audio.play().catch(()=>{if(current===generation)status('Tap play under Correct pronunciation. Your recording will follow when it finishes.');});
   });
  }
  const utterance=new Utterance(text);utterance.lang='zh-CN';utterance.voice=voice;utterance.rate=.72;
  status('1 · Listen to the correct pronunciation.');
  return new Promise((resolve,reject)=>{
   cancelPending=()=>resolve(false);
   utterance.onend=()=>{if(current!==generation)return;cancelPending=null;resolve(true);};
   utterance.onerror=()=>{if(current!==generation)return;cancelPending=null;reject(Error('The model voice could not play. Try Listen again, or use the pinyin guide.'));};
   synthesis.speak(utterance);
  });
 }
 async function replay(audio){
  if(!audio)throw Error('Record your voice first.');
  const current=generation;player=audio;audio.currentTime=0;
  status('2 · Listen to your recording, then read the guidance below.');
  audio.onended=()=>{if(current===generation){player=null;status('3 · Read What to practise next, then record another try.');}};
  try{await audio.play();}catch{if(current===generation){player=null;status('Tap play in Your recording, then read the guidance below.');}}
 }
 async function compare(text,audio){if(await model(text))await replay(audio);}
 return {stop,model,compare,replay,isPlaying:audio=>player===audio};
}
