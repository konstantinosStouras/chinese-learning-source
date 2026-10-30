import {escapeHtml as e} from './core.mjs';
export function avatarSource(user,profile){
 const uploaded=profile?.photo;
 if(typeof uploaded==='string'&&uploaded.length<=100000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(uploaded))return uploaded;
 const google=user?.providerData?.find(p=>p.providerId==='google.com')?.photoURL;
 for(const value of [user?.photoURL,google]){try{const url=new URL(value);if(url.protocol==='https:')return url.href;}catch{}}
 return '';
}
export function avatar(user,profile,large=false){const src=avatarSource(user,profile);return `<span class="avatar ${large?'avatar-large':''}">${src?`<img src="${e(src)}" alt="" referrerpolicy="no-referrer">`:e((user?.displayName||'U').slice(0,1))}</span>`;}
export function accountMenu(user,profile,{admin=false,teacher=false,inbox={}}={}){
 const unread=inbox.lastAdminSeq>inbox.userReadSeq;
 const role=admin?'Admin':teacher?'Teacher':'Student';
 const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
 const person=icon('M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0M4 21v-2a8 8 0 0 1 16 0v2'),chat=icon('M3 4h18v13H8l-5 4V4');
 return `<div class="account-menu" aria-label="Your account"><div class="account-menu-identity">${avatar(user,profile,true)}<div><small class="signed-in-label">SIGNED IN AS</small><strong>${e(user.displayName||'Your account')}</strong><span>${e(user.email||'')}</span><small>${role}</small></div></div><div class="account-menu-links"><button type="button" data-action="my-messages">${chat}Messages <span class="unread-dot" data-unread-indicator ${unread?'':'hidden'} aria-hidden="true"></span><span class="sr-only" data-unread-label ${unread?'':'hidden'}>Unread messages</span></button><button type="button" data-action="site-feedback">${chat}Feedback to improve website</button><button type="button" data-action="account-settings">${person}Edit profile</button></div><button type="button" class="btn primary account-signout" data-action="logout">Sign out</button></div>`;
}
export function accountSettings(user,profile,{admin=false,teacher=false}={}){
 return `<h2>Profile & account settings</h2><div class="account-settings-identity">${avatar(user,profile,true)}<div><strong>${e(user.displayName||'Your account')}</strong><p>${e(user.email||'')}</p><span class="pill">${admin?'Admin':teacher?'Teacher':'Student'}</span></div></div>${user.uid!=='shared-teacher'?`<div class="profile-photo-actions"><label class="btn small">Upload photo<input id="profile-photo" class="sr-only" type="file" accept="image/png,image/jpeg,image/webp"></label>${profile?.photo?'<button class="btn small" data-action="remove-profile-photo">Use default photo</button>':''}<button class="btn small" data-action="edit-profile">Edit my name</button></div><p class="small muted">Google photos appear automatically. Uploaded images are cropped to a small square. PNG, JPG or WebP, up to 5 MB.</p><p id="profile-photo-status" class="small" role="status"></p><label class="notification-choice"><input type="checkbox" id="email-notifications" ${profile?.emailNotifications===false?'':'checked'}> Email me when I receive a message</label><details class="account-removal"><summary>Account deletion</summary><p>Only use this if you want to permanently remove your account and practice data. To leave this session, choose Sign out.</p><button class="btn small danger-outline" data-action="delete-self">Delete my account…</button></details>`:''}`;
}
export async function prepareAvatar(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a PNG, JPG or WebP image under 5 MB.');
 const url=URL.createObjectURL(file),im=new Image();
 try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('This image could not be opened.'));im.src=url;});const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;const ctx=canvas.getContext('2d'),size=Math.min(im.width,im.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,192,192);ctx.drawImage(im,(im.width-size)/2,(im.height-size)/2,size,size,0,0,192,192);return canvas.toDataURL('image/jpeg',.85);}finally{URL.revokeObjectURL(url);}
}
