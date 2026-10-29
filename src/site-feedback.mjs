import {escapeHtml as e} from './core.mjs';
export function feedbackForm(user={}){return `<section aria-labelledby="feedback-title"><span class="pill">Help shape Chinese Practice</span><h2 id="feedback-title">Tell us what could improve.</h2><p>Report a problem, share an idea, or leave a comment. No sign-in needed. Your feedback is private to the teaching team.</p><form id="site-feedback-form" class="form-stack"><label>Your feedback<textarea name="body" maxlength="5000" rows="5" placeholder="What happened? What would make this better?"></textarea></label><div id="feedback-drop" class="feedback-drop"><label>Screenshots (optional)<input id="feedback-files" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><p class="small muted">Choose, drag and drop, or paste up to 5 images. PNG, JPG or WebP, up to 10 MB each. Images are resized before sending.</p></div><div id="feedback-previews" class="feedback-previews"></div><div class="form-grid"><label>Your name (optional)<input name="name" maxlength="120" autocomplete="name" value="${e(user?.displayName||'')}"></label><label>Email for a reply (optional)<input name="email" type="email" maxlength="254" autocomplete="email" value="${e(user?.email||'')}"></label></div><p class="small muted">Send text, screenshots, or both. Please crop out passwords and any personal information you do not want to share. We store submissions privately for the teaching team to review.</p><p class="auth-error" role="alert" hidden></p><button type="submit" class="btn primary wide">Send feedback</button></form></section>`;}
export async function prepareScreenshot(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a PNG, JPG or WebP image under 10 MB.');
 const url=URL.createObjectURL(file),image=new Image();
 try{
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('This image could not be opened. Try another screenshot.'));image.src=url;});
  const canvas=document.createElement('canvas');let scale=Math.min(1,1800/image.width,1800/image.height);
  for(let attempt=0;attempt<7;attempt++){
   canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/jpeg',.82-attempt*.065);
   if(data.length<290000)return {data};scale*=.8;
  }
  throw Error('This screenshot is too large. Crop it and try again.');
 }finally{URL.revokeObjectURL(url);}
}
export function initFeedback({api,modal,user,isAdmin}){
 let images=[],pending=0,requestId='',formSession=0,sending=false,items=[],hasMore=false;
 const error=message=>{const el=document.querySelector('#site-feedback-form .auth-error');if(el){el.textContent=message;el.hidden=false;}};
 const preview=()=>{const el=document.querySelector('#feedback-previews');if(el)el.innerHTML=images.map((im,i)=>`<div><img src="${im.data}" alt="Screenshot ${i+1}"><button type="button" class="btn small" data-action="remove-feedback-image" data-index="${i}">Remove ${i+1}</button></div>`).join('');};
 async function addFiles(files){
  if(sending)return;const session=formSession;
  for(const file of files){
   if(images.length+pending>=5){error('You can attach up to five screenshots.');break;}
   pending++;try{const result=await prepareScreenshot(file);if(session===formSession)images.push(result);}catch(err){if(session===formSession)error(err.message);}finally{if(session===formSession){pending--;preview();}}
  }
 }
 function open(){formSession++;images=[];pending=0;sending=false;requestId=crypto.randomUUID();modal(feedbackForm(user()));document.querySelector('#dialog').classList.add('message-modal');document.querySelector('#dialog').setAttribute('aria-labelledby','feedback-title');}
 const date=value=>value?new Date(value).toLocaleString():'Just received';
 function inboxView(){return `<h2>Feedback inbox</h2><p>Private comments and screenshots from Chinese Practice visitors.</p><div class="feedback-inbox">${items.length?items.map(x=>`<button class="feedback-item" data-action="open-feedback-item" data-id="${x.id}"><span class="pill">${x.status==='closed'?'Closed':'Open'}</span><strong>${e(x.body||'Screenshot feedback')}</strong><span>${e(x.name||'Anonymous')} · ${e(date(x.createdAt))} · ${x.imageCount||0} screenshots</span></button>`).join(''):'<p>No feedback yet.</p>'}</div>${hasMore?'<button class="btn" data-action="more-feedback">Load older feedback</button>':''}`;}
 async function inbox(more=false){if(!isAdmin())return;const response=await api({action:'listFeedback',...(more&&items.length?{before:items.at(-1).id}:{})});items=more?[...items,...response.items]:response.items;hasMore=response.hasMore;modal(inboxView());document.querySelector('#dialog').classList.add('message-modal');}
 async function detail(id){if(!isAdmin())return;const x=await api({action:'getFeedback',id});modal(`<h2>Visitor feedback</h2><p>${e(x.name||'Anonymous')} · ${e(date(x.createdAt))}</p>${x.email?`<p>Reply email: <a href="mailto:${e(x.email)}">${e(x.email)}</a></p>`:''}<p class="small muted">Page: ${e(x.page)}</p><p class="feedback-body">${e(x.body||'Screenshot only')}</p><div class="feedback-images">${x.images.map((im,i)=>`<a href="${im.data}" download="feedback-screenshot-${i+1}.jpg" aria-label="Download screenshot ${i+1}"><img src="${im.data}" alt="Submitted screenshot ${i+1}"></a>`).join('')}</div><div class="row"><button class="btn" data-action="feedback-inbox">Back to inbox</button><button class="btn primary" data-action="feedback-status" data-id="${x.id}" data-status="${x.status==='closed'?'open':'closed'}">${x.status==='closed'?'Reopen':'Mark closed'}</button></div>`);document.querySelector('#dialog').classList.add('message-modal');}
 document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return;
  try{switch(b.dataset.action){
   case 'site-feedback':event.preventDefault();open();break;
   case 'remove-feedback-image':if(!sending){images.splice(Number(b.dataset.index),1);preview();}break;
   case 'feedback-inbox':await inbox();break;
   case 'more-feedback':await inbox(true);break;
   case 'open-feedback-item':await detail(b.dataset.id);break;
   case 'feedback-status':b.disabled=true;await api({action:'setFeedbackStatus',id:b.dataset.id,status:b.dataset.status});await detail(b.dataset.id);break;
  }}catch(err){b.disabled=false;const p=document.createElement('p');p.setAttribute('role','alert');p.textContent=err.message;document.querySelector('#dialog').append(p);}
 });
 document.addEventListener('change',event=>{if(event.target.id==='feedback-files'){addFiles([...event.target.files]);event.target.value='';}});
 document.addEventListener('dragover',event=>{if(event.target.closest('#feedback-drop'))event.preventDefault();});
 document.addEventListener('drop',event=>{if(event.target.closest('#feedback-drop')){event.preventDefault();addFiles([...event.dataTransfer.files]);}});
 document.addEventListener('paste',event=>{if(document.querySelector('#site-feedback-form')&&document.querySelector('#dialog').open){const files=[...event.clipboardData.items].filter(x=>x.kind==='file').map(x=>x.getAsFile()).filter(Boolean);if(files.length){event.preventDefault();addFiles(files);}}});
 document.addEventListener('submit',async event=>{
  const form=event.target;if(form.id!=='site-feedback-form')return;event.preventDefault();if(sending)return;
  if(pending){error('Please wait for your screenshots to finish preparing.');return;}
  const fd=new FormData(form);if(!String(fd.get('body')).trim()&&!images.length){error('Write a comment or attach a screenshot.');return;}
  sending=true;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Sending…';form.setAttribute('aria-busy','true');form.querySelectorAll('input,textarea').forEach(x=>x.disabled=true);
  try{const result=await api({action:'submitFeedback',body:fd.get('body'),name:fd.get('name'),email:fd.get('email'),images,page:location.pathname+location.hash,requestId});if(form.isConnected)modal(`<h2>Thank you — feedback received.</h2><p>Your comments and screenshots have been saved privately for the teaching team.</p><p class="small muted">Reference: ${e(result.id.slice(0,12))}</p><button class="btn primary" data-action="site-feedback">Send another</button>`);}
  catch(err){error(err.message);button.disabled=false;button.textContent='Try sending again';form.querySelectorAll('input,textarea').forEach(x=>x.disabled=false);}
  finally{sending=false;form.removeAttribute('aria-busy');}
 });
}
