const {createHash}=require('node:crypto');
const nodemailer=require('nodemailer');
const SENDER='kstouras@gmail.com',SITE='https://www.stouras.com/chinese/';
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notification(firstName){
 const greeting=firstName?`Hello ${firstName},`:'Hello,';
 return {subject:'New message from your Chinese Practice teaching team',text:`${greeting}\n\nYour teaching team has sent you a private message in Chinese Practice.\n\nRead and reply: ${SITE}#messages\n\nSign in with the account receiving this email. Your message stays private on the website. Please reply there, rather than by email.\n\nYou can switch these notifications off in your account: ${SITE}#account\n\nChinese Practice · Learn. Try. Grow.`,html:`<!doctype html><html><body style="margin:0;background:#f5f6ef;font-family:Arial,sans-serif;color:#163f35"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fffef9;border-radius:20px"><p style="font-size:13px;letter-spacing:2px">CHINESE PRACTICE</p><h1 style="font-size:28px">A message from your teaching team.</h1><p>${escape(greeting)}</p><p style="line-height:1.7">You have a new private message. Open Chinese Practice to read it and reply.</p><p style="margin:28px 0"><a href="${SITE}#messages" style="display:inline-block;padding:15px 24px;background:#163f35;color:white;border-radius:10px;text-decoration:none">Read and reply</a></p><p style="font-size:13px;line-height:1.7;color:#60736a">Sign in with the account receiving this email. Please reply on the website, rather than by email.</p><hr style="border:0;border-top:1px solid #dce4d7"><p style="font-size:12px;color:#60736a">You can turn off message emails in <a href="${SITE}#account">your account settings</a>.</p></div></body></html>`};
}
function transport(password){return nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:SENDER,pass:password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000});}
function createMailer(db,auth,readPassword,makeTransport=transport){return async function notify(ref){
 const snapshot=await ref.get();if(!snapshot.exists)return;
 const m=snapshot.data();if(m.from!=='admin'||!m.notifyEmail)return;
 const uid=ref.parent.parent.id,profileRef=db.doc(`users/${uid}`),deletionRef=db.doc(`accountDeletions/${uid}`);
 const [settings,profile,deletion]=await Promise.all([db.doc('settings/public').get(),profileRef.get(),deletionRef.get()]);
 const p=profile.data()||{};
 let user;try{user=await auth.getUser(uid);}catch(e){if(e.code==='auth/user-not-found')return;throw e;}
 if(!settings.data()?.mailEnabled||p.emailNotifications===false||deletion.exists||user.disabled||!user.emailVerified||!user.email||/\.(invalid|test|localhost)$/i.test(user.email)){
  await db.runTransaction(async t=>{const current=await t.get(ref);if(current.exists&&!['sent','skipped'].includes(current.data().mailStatus))t.update(ref,{mailStatus:'skipped'});});return;
 }
 const claimed=await db.runTransaction(async t=>{
  const [current,deleted]=await Promise.all([t.get(ref),t.get(deletionRef)]);if(!current.exists||deleted.exists)return false;
  const d=current.data();if(['sent','skipped','failed'].includes(d.mailStatus))return false;
  if(d.mailLeaseUntil>Date.now())throw Error('notification-lease-active');
  if((d.mailAttempts||0)>=5){t.update(ref,{mailStatus:'failed'});return false;}
  t.update(ref,{mailStatus:'sending',mailAttempts:(d.mailAttempts||0)+1,mailLeaseUntil:Date.now()+120000});return true;
 });
 if(!claimed)return;
 let smtp;
 try{
  smtp=makeTransport(await readPassword());
  // Recheck immediately before delivery; deleting or opting out cancels queued mail.
  const [latest,deleted,item,config]=await Promise.all([profileRef.get(),deletionRef.get(),ref.get(),db.doc('settings/public').get()]);
  if(!item.exists||deleted.exists||latest.data()?.emailNotifications===false||!config.data()?.mailEnabled){
   await db.runTransaction(async t=>{if((await t.get(ref)).exists)t.update(ref,{mailStatus:'skipped',mailLeaseUntil:0});});return;
  }
  const result=await smtp.sendMail({from:`Chinese Practice <${SENDER}>`,to:user.email,messageId:`<chinese-${createHash('sha256').update(ref.path).digest('hex')}@stouras.com>`,...notification(p.firstName||'')});
  if(!result.accepted?.length)throw Error('recipient-not-accepted');
  await db.runTransaction(async t=>{if((await t.get(ref)).exists)t.update(ref,{mailStatus:'sent',mailLeaseUntil:0});});
 }catch(error){
  await db.runTransaction(async t=>{const current=await t.get(ref);if(current.exists)t.update(ref,{mailStatus:(current.data().mailAttempts||0)>=5?'failed':'retrying',mailLeaseUntil:0});});
  // Do not log SMTP responses: they can contain recipient addresses or credentials.
  throw Error('notification-delivery-failed');
 }finally{smtp?.close();}
};}
module.exports={SENDER,notification,transport,createMailer};
