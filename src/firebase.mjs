import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,EmailAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup,signInWithPopup,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,sendEmailVerification,sendPasswordResetEmail,reload,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,deleteDoc,writeBatch,query,where,orderBy,limit,serverTimestamp,onSnapshot} from 'firebase/firestore';
import {getFunctions,httpsCallable} from 'firebase/functions';
import config from './firebase-config.json';
import validation from '../_chinese-firebase/functions/validation.js';
export const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const call=httpsCallable(getFunctions(app,'europe-west1'),'chineseApi',{timeout:90000});
export const api=async data=>{
 if(!auth.currentUser&&data.action!=='submitFeedback')throw Error('Sign in to continue.');
 if(data.action==='saveLesson'){
  const lesson=validation.validateLesson({...data.lesson,published:data.publish===true});
  const id=`${lesson.moduleId}-${String(lesson.week).padStart(2,'0')}`,value={...lesson,updatedBy:auth.currentUser.uid,updatedAt:serverTimestamp()},batch=writeBatch(db);
  batch.set(doc(db,'drafts',id),value);
  if(data.publish===true)batch.set(doc(db,'lessons',id),{...value,published:true});
  if(data.unpublish===true)batch.delete(doc(db,'lessons',id));
  await batch.commit();return {saved:true};
 }
 return (await call(data)).data;
};
export const googleLogin=()=>signInWithPopup(auth,new GoogleAuthProvider());
export async function confirmIdentity(password){
 const user=auth.currentUser;if(!user)throw Error('Sign in to continue.');
 if(user.providerData.some(p=>p.providerId==='google.com'))await reauthenticateWithPopup(user,new GoogleAuthProvider());
 else await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
 await user.getIdToken(true);
}
export const watchInbox=(uid,callback)=>onSnapshot(doc(db,'threads',uid),s=>callback(s.data()||{}),()=>callback({}));
export const emailLogin=(email,password)=>signInWithEmailAndPassword(auth,email.trim(),password);
let registrationReady=Promise.resolve();
export const waitForRegistration=()=>registrationReady;
export function registerEmail({email,password,firstName,lastName,moduleId}){
 const operation=(async()=>{
  const result=await createUserWithEmailAndPassword(auth,email.trim(),password);
  await saveNames(firstName,lastName,moduleId);
  let verificationSent=true;
  try{await sendEmailVerification(result.user);}catch{verificationSent=false;}
  return {user:result.user,verificationSent};
 })();
 registrationReady=operation.catch(()=>{});
 return operation;
}
export async function saveNames(firstName,lastName,moduleId){
 firstName=String(firstName||'').trim();lastName=String(lastName||'').trim();
 if(!firstName||!lastName||firstName.length>60||lastName.length>60)throw Error('Enter your first and last names (up to 60 characters each).');
 const user=auth.currentUser;if(!user)throw Error('Sign in to save your name.');
 const name=`${firstName} ${lastName}`.slice(0,120);
 await setDoc(doc(db,'users',user.uid),{firstName,lastName,name,email:user.email,moduleId,updatedAt:serverTimestamp()},{merge:true});
 await updateProfile(user,{displayName:name});
 return {firstName,lastName,name};
}
export const resetPassword=email=>sendPasswordResetEmail(auth,email.trim());
export const resendVerification=()=>sendEmailVerification(auth.currentUser);
export async function refreshVerification(){await reload(auth.currentUser);await auth.currentUser.getIdToken(true);return auth.currentUser.emailVerified;}
export const passwordLogin=(username,password)=>{
 if(username.trim().toLowerCase()!=='teacher')throw Error('The shared username is teacher.');
 return signInWithEmailAndPassword(auth,'shared-teacher@stouras-chinese.firebaseapp.com',password);
};
export {collection,doc,getDoc,getDocs,setDoc,addDoc,query,where,orderBy,limit,serverTimestamp,onAuthStateChanged,signOut};

export async function savePhoto(photo){const user=auth.currentUser;if(!user)throw Error('Sign in to update your photo.');await setDoc(doc(db,'users',user.uid),{photo,updatedAt:serverTimestamp()},{merge:true});}
