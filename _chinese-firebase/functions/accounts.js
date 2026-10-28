const {HttpsError}=require('firebase-functions/v2/https');
const {FieldValue,FieldPath}=require('firebase-admin/firestore');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const OWNER='kstouras@gmail.com';
const stamp=()=>FieldValue.serverTimestamp();
function uid(value){if(typeof value!=='string'||!value||value.length>128||value.includes('/'))fail('invalid-argument','Choose a registered user.');return value;}
function recent(auth){if(!Number.isFinite(auth.token.auth_time)||Date.now()/1000-auth.token.auth_time>300)fail('failed-precondition','Sign in again to confirm this deletion.');}
async function active(db,auth,id){
 if((await db.doc(`accountDeletions/${id}`).get()).exists)fail('failed-precondition','This account is being deleted.');
 let user;try{user=await auth.getUser(id);}catch(e){if(e.code==='auth/user-not-found')fail('not-found','This account no longer exists.');throw e;}
 if(user.disabled)fail('permission-denied','This account is disabled.');return user;
}
function createAccounts(db,auth){return {
 async handle(d,caller,admin,isOwner){
  const id=caller.uid;
  if(d.action==='listUsers'){
   if(!admin)fail('permission-denied','Administrator access is required.');
   if(d.pageToken!==undefined&&(typeof d.pageToken!=='string'||d.pageToken.length>2048))fail('invalid-argument','Refresh the directory.');
   const page=await auth.listUsers(100,d.pageToken||undefined);
   const users=page.users.filter(u=>u.uid!=='shared-teacher');
   const refs=users.flatMap(u=>['users','admins','threads','accountDeletions'].map(c=>db.doc(`${c}/${u.uid}`)));
   const docs=refs.length?await db.getAll(...refs):[];
   return {users:users.map((u,i)=>{const p=docs[i*4].data()||{},thread=docs[i*4+2].data()||{};return {id:u.uid,name:p.name||u.displayName||'Learner',firstName:p.firstName||'',lastName:p.lastName||'',email:u.email||'',moduleId:p.moduleId||'',verified:u.emailVerified,disabled:u.disabled,deleting:docs[i*4+3].exists,admin:docs[i*4+1].exists||u.email===OWNER,createdAt:u.metadata.creationTime,lastSignIn:u.metadata.lastSignInTime,needsReply:(thread.lastUserSeq||0)>(thread.adminReadSeq||0)};}),nextPageToken:page.pageToken||null};
  }
  if(['getMessages','sendMessage','readMessages'].includes(d.action)){
   const target=uid(d.uid||id),teacher=admin&&target!==id;
   if(!admin&&target!==id)fail('permission-denied','You can only open your own messages.');
   if(!admin&&caller.token.email_verified!==true)fail('permission-denied','Verify your email before using messages.');
   await active(db,auth,target);
   const ref=db.doc(`threads/${target}`);
   if(d.action==='getMessages'){
    let q=ref.collection('items').orderBy('seq','desc');
    if(d.before!==undefined){if(!Number.isSafeInteger(d.before)||d.before<1)fail('invalid-argument','Choose an earlier message.');q=q.where('seq','<',d.before);}
    const [head,items]=await Promise.all([ref.get(),q.limit(51).get()]);
    return {exists:head.exists,items:items.docs.slice(0,50).map(x=>({id:x.id,...x.data(),createdAt:x.data().createdAt?.toMillis()||null})).reverse(),hasOlder:items.size>50};
   }
   if(d.action==='readMessages'){
    if(!Number.isSafeInteger(d.seq)||d.seq<0)fail('invalid-argument','Refresh your messages.');
    await db.runTransaction(async t=>{const s=await t.get(ref);if(!s.exists)return;const h=s.data(),field=teacher?'adminReadSeq':'userReadSeq';t.update(ref,{[field]:Math.max(h[field]||0,Math.min(d.seq,h.seq||0))});});return {saved:true};
   }
   const body=typeof d.body==='string'?d.body.trim():'';
   if(!body||body.length>4000)fail('invalid-argument','Write a message of 1–4,000 characters.');
   if(typeof d.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(d.requestId))fail('invalid-argument','Please try sending again.');
   const item=ref.collection('items').doc(`${id}-${d.requestId}`),day=new Date().toISOString().slice(0,10),quota=db.doc(`messageUsage/${day}-${id}`);
   await db.runTransaction(async t=>{
    const [head,existing,use,deleting,callerDeleting]=await Promise.all([t.get(ref),t.get(item),t.get(quota),t.get(db.doc(`accountDeletions/${target}`)),t.get(db.doc(`accountDeletions/${id}`))]);
    if(deleting.exists||callerDeleting.exists)fail('failed-precondition','This account is being deleted.');
    if(existing.exists)return;
    if(!admin&&!head.exists)fail('permission-denied','Your teaching team can start a conversation with you here.');
    if((use.data()?.count||0)>=(admin?500:100))fail('resource-exhausted','Today’s message limit has been reached. Try again tomorrow.');
    const h=head.data()||{},seq=(h.seq||0)+1,from=teacher?'admin':'user';
    t.set(item,{body,from,senderUid:id,seq,createdAt:stamp(),...(teacher?{notifyEmail:true,mailStatus:'pending'}:{})});
    t.set(ref,{uid:target,seq,updatedAt:stamp(),[teacher?'lastAdminSeq':'lastUserSeq']:seq,[teacher?'adminReadSeq':'userReadSeq']:seq},{merge:true});
    t.set(quota,{uid:id,count:FieldValue.increment(1)},{merge:true});
   });return {sent:true};
  }
  if(d.action==='deleteAccount'){
   const target=uid(d.uid||id),self=target===id;
   if(!self&&!admin)fail('permission-denied','Administrator access is required.');
   recent(caller);
   if(d.confirmation!=='DELETE')fail('invalid-argument','Type DELETE to confirm.');
   if(target==='shared-teacher')fail('failed-precondition','The shared teaching account is managed in Settings.');
   const user=await auth.getUser(target);
   if(!self&&user.email===OWNER)fail('permission-denied','Another administrator cannot delete the project owner.');
   if(!self&&!isOwner&&(await db.doc(`admins/${target}`).get()).exists)fail('permission-denied','Only the owner can delete another administrator.');
   const ref=db.doc(`accountDeletions/${target}`);
   await db.runTransaction(async t=>{if(!(await t.get(ref)).exists)t.create(ref,{status:'requested',requestedAt:stamp()});});
   return {queued:true};
  }
  return null;
 },
 async purge(id){
  uid(id);const order=db.doc(`accountDeletions/${id}`);if((await order.get()).data()?.status!=='requested')return;
  try{await auth.updateUser(id,{disabled:true});await auth.revokeRefreshTokens(id);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  async function erase(query){for(;;){const page=await query.limit(300).get();if(page.empty)break;const batch=db.batch();page.docs.forEach(d=>batch.delete(d.ref));await batch.commit();}}
  for(const name of ['attempts','speechFeedback','usage','messageUsage'])await erase(db.collection(name).where('uid','==',id));
  // Older speech quota documents predate the uid field; remove their references too.
  let cursor;
  for(;;){let q=db.collection('usage').orderBy(FieldPath.documentId()).limit(300);if(cursor)q=q.startAfter(cursor);const page=await q.get();if(page.empty)break;const batch=db.batch();page.docs.filter(d=>d.id.endsWith(`-${id}`)).forEach(d=>batch.delete(d.ref));await batch.commit();cursor=page.docs.at(-1);}
  await db.recursiveDelete(db.doc(`threads/${id}`));
  // Remove this person's messages from other conversations as well.
  const threads=await db.collection('threads').get();
  for(const thread of threads.docs){
   await erase(thread.ref.collection('items').where('senderUid','==',id));
   const remaining=await thread.ref.collection('items').orderBy('seq','desc').get();
   await thread.ref.update({lastAdminSeq:remaining.docs.find(d=>d.data().from==='admin')?.data().seq||0,lastUserSeq:remaining.docs.find(d=>d.data().from==='user')?.data().seq||0});
  }
  const batch=db.batch();for(const name of ['users','admins','access'])batch.delete(db.doc(`${name}/${id}`));await batch.commit();
  try{await auth.deleteUser(id);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  await order.set({status:'done',completedAt:stamp()});
 }
};}
module.exports={createAccounts,recent};
