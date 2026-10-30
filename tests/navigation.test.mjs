import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationHeader} from '../src/navigation-view.mjs';
import {accountMenu} from '../src/account-view.mjs';
const user={displayName:'<Test User>',email:'test@example.invalid'};

test('signed-in header separates navigation from private account actions',()=>{
 const html=navigationHeader({user}),header=html.split('</header>')[0];
 assert.match(header,/aria-label="Open navigation"/);
 assert.match(header,/aria-label="Your account: &lt;Test User&gt;"/);
 assert.doesNotMatch(header,/data-action="(my-messages|site-feedback|performance)"/);
 assert.match(html,/data-action="performance"/);
 const profile=accountMenu(user,{});
 assert.match(profile,/data-action="my-messages"/);
 assert.match(profile,/data-action="site-feedback"/);
 assert.doesNotMatch(profile,/data-action="performance"/);
});
test('navigation retains guest feedback and respects teaching roles',()=>{
 const guest=navigationHeader({}),student=navigationHeader({user}),teacher=navigationHeader({user,teacher:true},true),admin=navigationHeader({user,admin:true},true);
 assert.match(guest,/data-action="register"/);assert.match(guest,/data-action="site-feedback"/);
 assert.doesNotMatch(student,/Teaching space|data-tab=/);
 assert.match(teacher,/data-tab="coach"/);assert.doesNotMatch(teacher,/data-tab="settings"|feedback-inbox/);
 assert.match(admin,/data-tab="settings"/);assert.match(admin,/feedback-inbox/);
});
test('unread message indicators remain available on avatar and in dropdown',()=>{
 for(const inbox of [{lastAdminSeq:2,userReadSeq:1},{lastAdminSeq:2,userReadSeq:2}]){
  const unread=inbox.lastAdminSeq>inbox.userReadSeq;
  for(const html of [navigationHeader({user,inbox}),accountMenu(user,{}, {inbox})]){
   assert.equal(/data-unread-indicator hidden/.test(html),!unread);
   assert.match(html,/data-unread-label/);
  }
 }
});
