import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import permissions from '../_chinese-firebase/functions/roles.js';
import {directoryRows} from '../src/people-view.mjs';
const auth=email=>({uid:'person',token:{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}});
test('only the verified Google owner is admin; assignments grant teacher access',()=>{
 assert.equal(permissions.roles(auth('kstouras@gmail.com')).role,'admin');
 assert.equal(permissions.roles(auth('lucy.liu@ucd.ie'),true).role,'teacher');
 assert.equal(permissions.roles(auth('student@example.invalid')).role,'student');
 assert.equal(permissions.roles({...auth('kstouras@gmail.com'),token:{email:'kstouras@gmail.com',email_verified:true,firebase:{sign_in_provider:'password'}}},true).role,'teacher');
 assert.equal(permissions.roles({...auth('teacher@example.invalid'),token:{email_verified:false}},true).role,'student');
 assert.equal(permissions.roles({uid:'shared-teacher',token:{}},true).role,'teacher');
});
test('teachers can edit lessons but cannot reach technical actions',()=>{
 const teacher=permissions.roles(auth('teacher@example.invalid'),true),student=permissions.roles(auth('student@example.invalid')),admin=permissions.roles(auth('kstouras@gmail.com'));
 permissions.authorize('saveLesson',teacher);permissions.authorize('listUsers',teacher);permissions.authorize('setModules',teacher);permissions.authorize('saveLesson',admin);
 assert.throws(()=>permissions.authorize('saveLesson',student),e=>e.code==='permission-denied');
 for(const action of ['setAdmin','setRole','saveMail','setMail','sharedLogin','saveProvider','setProvider','listFeedback','getFeedback','setFeedbackStatus']){
  assert.throws(()=>permissions.authorize(action,teacher),e=>e.code==='permission-denied');
  assert.throws(()=>permissions.authorize(action,student),e=>e.code==='permission-denied');
  permissions.authorize(action,admin);
 }
});
test('role menus show lessons and people to teachers and all controls to the admin',()=>{
 const source=fs.readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
 const c={S:{user:{uid:'u',displayName:'Test'},admin:false,teacher:false,inbox:{},adminTab:'curriculum'},adminPage:false,e:String,avatar:()=>'',icon:()=>'',btn:(t)=>t,editorView:()=>'<div>LESSONS</div>',peopleView:()=>'<div>PEOPLE</div>',settingsView:()=>'<div>SETTINGS</div>'};
 vm.createContext(c);vm.runInContext(source.split('\n').filter(l=>/^function (canTeach|header|adminView)\(/.test(l)).join('\n'),c);
 assert.ok(!c.header().includes('/chinese/admin/'));
 c.S.teacher=true;assert.ok(c.header().includes('/chinese/admin/'));
 const teacher=c.adminView();assert.ok(teacher.includes('LESSONS'));assert.ok(!teacher.includes('Settings'));assert.ok(teacher.includes('People'));assert.ok(!teacher.includes('People & practice'));assert.ok(!teacher.includes('Feedback inbox'));
 c.S.admin=true;const admin=c.adminView();assert.ok(admin.includes('Settings'));assert.ok(admin.includes('People & practice'));assert.ok(admin.includes('Feedback inbox'));
});
test('directory labels all three roles and allows only teacher/student assignments',()=>{
 const html=directoryRows([{id:'owner',email:'kstouras@gmail.com',name:'Owner',admin:true},{id:'teacher',name:'Lucy',teacher:true},{id:'student',name:'Student'}],{owner:true,self:'owner',modules:[],attempts:[]});
 for(const role of ['Admin','Teacher','Student'])assert.ok(html.includes(`>${role}</span>`));
 assert.ok(html.includes('Make teacher'));assert.ok(html.includes('Make student'));assert.ok(!html.includes('Make admin'));
});
