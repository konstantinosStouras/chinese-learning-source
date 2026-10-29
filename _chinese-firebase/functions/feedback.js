const {HttpsError}=require('firebase-functions/v2/https');
const {FieldValue}=require('firebase-admin/firestore');
const {createHash}=require('node:crypto');
const fail=(message)=>{throw new HttpsError('invalid-argument',message);};
function validateFeedback(d){
 const text=(key,max)=>{if(d[key]!==undefined&&typeof d[key]!=='string')fail('Invalid feedback details.');const value=(d[key]||'').trim();if(value.length>max)fail('Your feedback is too long.');return value;};
 const body=text('body',5000),name=text('name',120),email=text('email',254),page=text('page',500);
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email address or leave it blank.');
 if(page&&!/^\/chinese\/(?:[^\s]*)$/.test(page))fail('Invalid page.');
 if(typeof d.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(d.requestId))fail('Please try sending again.');
 const images=d.images||[];
 if(!Array.isArray(images)||images.length>5)fail('Attach up to five screenshots.');
 const clean=images.map(image=>{
  if(!image||typeof image.data!=='string'||image.data.length>300000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data))fail('Use a supported screenshot image.');
  const bytes=Buffer.from(image.data.split(',')[1],'base64');
  if(bytes.length<4||bytes.length>220000||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)fail('The screenshot could not be read.');
  return {data:image.data};
 });
 if(!body&&!clean.length)fail('Write a comment or attach a screenshot.');
 return {body,name,email,page,images:clean};
}
function createFeedback(db){return {
 async submit(d,req){
  const data=validateFeedback(d),day=new Date().toISOString().slice(0,10);
  const identity=createHash('sha256').update(`${day}:${req.rawRequest?.ip||'unknown'}`).digest('hex');
  const id=createHash('sha256').update(`${identity}:${d.requestId}`).digest('hex');
  const ref=db.doc(`siteFeedback/${id}`),quota=db.doc(`feedbackUsage/${day}-${identity}`),global=db.doc(`feedbackUsage/${day}-total`);
  await db.runTransaction(async t=>{
   const [existing,used,total]=await Promise.all([t.get(ref),t.get(quota),t.get(global)]);
   if(existing.exists)return;
   if((used.data()?.count||0)>=10||(total.data()?.count||0)>=200)throw new HttpsError('resource-exhausted','The feedback limit has been reached. Please try again tomorrow.');
   t.create(ref,{body:data.body,name:data.name,email:data.email,page:data.page,imageCount:data.images.length,status:'open',createdAt:FieldValue.serverTimestamp()});
   data.images.forEach((image,i)=>t.create(ref.collection('images').doc(String(i)),image));
   for(const target of [quota,global])t.set(target,{count:FieldValue.increment(1),expiresAt:new Date(Date.now()+3*86400000)},{merge:true});
  });
  return {sent:true,id};
 },
 async handle(d,admin){
  if(!['listFeedback','getFeedback','setFeedbackStatus'].includes(d.action))return null;
  if(!admin)throw new HttpsError('permission-denied','Administrator access is required.');
  if(d.action==='listFeedback'){
   let q=db.collection('siteFeedback').orderBy('createdAt','desc');
   if(d.before){if(typeof d.before!=='string'||!/^[a-f0-9]{64}$/.test(d.before))fail('Invalid feedback cursor.');const cursor=await db.doc(`siteFeedback/${d.before}`).get();if(!cursor.exists)fail('Refresh the feedback inbox.');q=q.startAfter(cursor);}
   const rows=await q.limit(31).get();return {items:rows.docs.slice(0,30).map(x=>({id:x.id,...x.data(),createdAt:x.data().createdAt?.toMillis()||null})),hasMore:rows.size>30};
  }
  if(typeof d.id!=='string'||!/^[a-f0-9]{64}$/.test(d.id))fail('Choose feedback from the inbox.');
  const ref=db.doc(`siteFeedback/${d.id}`),record=await ref.get();if(!record.exists)throw new HttpsError('not-found','This feedback no longer exists.');
  if(d.action==='setFeedbackStatus'){if(!['open','closed'].includes(d.status))fail('Choose open or closed.');await ref.update({status:d.status});return {saved:true};}
  const images=await ref.collection('images').orderBy('__name__').get();return {id:record.id,...record.data(),createdAt:record.data().createdAt?.toMillis()||null,images:images.docs.map(x=>x.data())};
 }
};}
module.exports={validateFeedback,createFeedback};
