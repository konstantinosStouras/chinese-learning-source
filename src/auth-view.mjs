import {escapeHtml as e} from './core.mjs';
const googleMark='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.91a6 6 0 0 1 0-3.82V7.5H3.07a10 10 0 0 0 0 9l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>';
export function authView(mode='signin',shared=false){
 const registering=mode==='register',reset=mode==='reset';
 return `<div class="auth-content"><div class="auth-emblem" aria-hidden="true">学</div><div class="auth-eyebrow">YOUR NEXT CHAPTER STARTS HERE</div><h2 id="auth-title">${reset?'Let’s get you back in.':registering?'A little practice. All yours.':'Welcome back.'}</h2><p class="auth-subtitle">${reset?'We’ll send a link to reset your password.':registering?'Save your progress. Find your voice. Grow every week.':'Pick up where you left off. One word at a time.'}</p>
 ${!reset?`<div class="auth-switch" aria-label="Account options"><button type="button" data-action="auth-mode" data-mode="signin" aria-pressed="${!registering}">Sign in</button><button type="button" data-action="auth-mode" data-mode="register" aria-pressed="${registering}">Register</button></div><button type="button" class="btn google-button wide" data-action="google">${googleMark} Continue with Google</button><p class="google-hint">Use your Gmail or Google account</p><div class="divider">or ${registering?'register':'sign in'} with email</div>`:''}
 <form id="auth-form" data-mode="${mode}" class="form-stack">
 ${registering?nameFields():''}
 <label>Email address<input type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com" required maxlength="254"></label>
 ${!reset?`<label>Password<span class="password-field"><input id="auth-password" type="password" name="password" autocomplete="${registering?'new-password':'current-password'}" ${registering?'minlength="10"':''} maxlength="128" placeholder="${registering?'At least 10 characters':'Enter your password'}" required><button type="button" data-action="toggle-password" aria-controls="auth-password" aria-pressed="false" aria-label="Show password">Show</button></span></label>${!registering?'<button type="button" class="auth-text-link" data-action="auth-mode" data-mode="reset">Forgot password?</button>':'<p class="auth-hint">We’ll email you a verification link. Verify your email to unlock practice.</p>'}`:''}
 <p class="auth-error" role="alert" hidden></p><p class="auth-success" role="status" hidden></p>
 <button class="btn primary wide auth-submit" type="submit">${reset?'Send reset link':registering?'Create my account':'Sign in'} <span aria-hidden="true">↗</span></button></form>
 ${reset?'<button type="button" class="auth-text-link auth-back" data-action="auth-mode" data-mode="signin">← Back to sign in</button>':`<p class="auth-foot">${registering?'Already have an account?':'New to Chinese Practice?'} <button type="button" data-action="auth-mode" data-mode="${registering?'signin':'register'}">${registering?'Sign in':'Register'}</button></p>`}
 ${shared?'<details class="shared-access"><summary>Shared teacher login</summary><form id="login-form" class="form-stack"><label>Username<input name="username" autocomplete="username" placeholder="teacher" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="btn wide" type="submit">Sign in as teacher</button></form></details>':''}
 <p class="auth-privacy">Your name and practice progress are shared with your teaching team. <a href="/chinese/#privacy" data-action="privacy">Privacy & practice data</a></p></div>`;
}
export function nameFields(firstName='',lastName=''){
 return `<div class="auth-names"><label>First name<input name="firstName" autocomplete="given-name" maxlength="60" value="${e(firstName)}" required></label><label>Last name<input name="lastName" autocomplete="family-name" maxlength="60" value="${e(lastName)}" required></label></div>`;
}
export function authError(error){
 const code=error?.code||'';
 if(/invalid-credential|wrong-password|user-not-found/.test(code))return 'Email or password not recognised. Try again, reset your password, or use Google if you registered with Google.';
 if(code.includes('email-already-in-use'))return 'This email already has an account. Sign in or reset your password instead.';
 if(code.includes('invalid-email'))return 'Enter a valid email address.';
 if(code.includes('weak-password')||code.includes('password-does-not-meet-requirements'))return 'Choose a stronger password with at least 10 characters.';
 if(code.includes('too-many-requests'))return 'Too many attempts. Please wait a little before trying again.';
 if(code.includes('account-exists-with-different-credential'))return 'This email already uses another sign-in method. Sign in with your original method first.';
 if(code.includes('popup-closed'))return 'Google sign-in was cancelled. You can try again.';
 if(code.includes('popup-blocked'))return 'Allow the Google sign-in pop-up in your browser, then try again.';
 if(code.includes('network'))return 'Check your internet connection and try again.';
 return code.startsWith('auth/')?'We couldn’t sign you in. Please try again.':String(error?.message||'Something went wrong. Please try again.');
}
