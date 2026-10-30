import {escapeHtml as e} from './core.mjs';
import {avatar} from './account-view.mjs';

export function navigationHeader({user,profile,admin=false,teacher=false,inbox={},adminTab='curriculum'},adminPage=false,hash=''){
 const unread=inbox.lastAdminSeq>inbox.userReadSeq;
 const teaching=admin||teacher;
 const current=active=>active?' aria-current="page"':'';
 const teachingLinks=[['curriculum','Curriculum'],['people',admin?'People & practice':'People'],['coach','Learning coach'],...(admin?[['settings','Settings']]:[])];
 return `<header class="topbar">
  <button type="button" class="btn navigation-toggle" data-action="navigation" aria-label="Open navigation" aria-expanded="false" aria-controls="navigation-drawer" aria-haspopup="dialog"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  <a class="brand" href="/chinese/"><span class="brand-mark">中</span><span><strong>Chinese Practice</strong><small>Learn. Try. Grow.</small></span></a>
  <div class="topnav">${user?`<div class="account-wrap"><button type="button" class="btn small profile-toggle" data-action="account" aria-expanded="false" aria-controls="account-menu-slot" aria-describedby="account-unread-status" aria-label="Your account: ${e(user.displayName||'Your account')}">${avatar(user,profile)}<span class="unread-dot" data-unread-indicator ${unread?'':'hidden'} aria-hidden="true"></span><span class="sr-only" id="account-unread-status" data-unread-label ${unread?'':'hidden'}>Unread messages</span></button><div id="account-menu-slot"></div></div>`:'<button type="button" class="btn small auth-nav-signin" data-action="sign-in">Sign in</button>'}</div>
 </header>
 <dialog id="navigation-drawer" class="navigation-drawer" aria-labelledby="navigation-title">
  <div class="navigation-heading"><h2 id="navigation-title">Explore</h2><button type="button" class="btn navigation-close" data-action="close-navigation" aria-label="Close navigation" autofocus>×</button></div>
  <nav class="navigation-links" aria-label="Main navigation">
   <a href="/chinese/"${current(!adminPage&&!hash.startsWith('#performance')&&hash!=='#privacy')}>My learning</a>
   ${user?`<a href="/chinese/#performance" data-action="performance"${current(!adminPage&&hash.startsWith('#performance'))}>Performance</a>`:'<button type="button" data-action="register">Create an account</button><button type="button" data-action="site-feedback">Feedback</button>'}
   ${teaching?`<h3>Teaching space</h3>${teachingLinks.map(([key,label])=>`<a href="/chinese/admin/#${key}"${adminPage?` data-action="admin-tab" data-tab="${key}"`:''}${current(adminPage&&adminTab===key)}>${label}</a>`).join('')}${admin?'<button type="button" data-action="feedback-inbox">Feedback inbox</button>':''}`:''}
   <h3>About</h3><a href="/chinese/#privacy" data-action="privacy"${current(!adminPage&&hash==='#privacy')}>Privacy & practice data</a>
  </nav>
 </dialog>`;
}

