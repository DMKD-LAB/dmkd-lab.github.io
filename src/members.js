import { supabase, configured, loadAccount, saveProfile, addGalleryPhoto, deleteGalleryPhoto, assetUrl } from './api.js';
import { escapeHtml as e, normalizeKeywords, validateSocialUrl, validateImage } from './validation.js';
import { programs, suggestedKeywords } from './content.js';
import { icon } from './icons.js';

let hooks, user = null, account = null, keywords = [], selectedPhoto = null, photoPreview = '', accountVersion = 0;
const dialog = document.querySelector('#member-dialog');
const incoming = new URLSearchParams(location.hash.slice(1));
let passwordRecovery = ['recovery','invite'].includes(incoming.get('type')) || ['recovery','invite'].includes(new URLSearchParams(location.search).get('account'));

function releasePreview() { if (photoPreview) URL.revokeObjectURL(photoPreview); photoPreview=''; selectedPhoto=null; }
function shell(title, subtitle, body, wide = false) {
  releasePreview();
  dialog.className = wide ? 'member-dialog wide' : 'member-dialog';
  dialog.innerHTML = `<button class="icon-button close-dialog" aria-label="Close member area">${icon('close')}</button><p class="eyebrow">DMKD LAB / MEMBER AREA</p><h2 id="dialog-title">${title}</h2><p class="dialog-subtitle">${subtitle}</p>${body}`;
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  if (!dialog.open) dialog.showModal();
}
const feedback = () => '<p class="form-feedback" role="status" aria-live="polite"></p>';
function message(form, text, success=false) { const el=form.querySelector('.form-feedback');el.textContent=text;el.classList.toggle('success',success); }
async function submitting(form, fn) {
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  const text = button.innerHTML;button.disabled = true;button.textContent='Please wait…';message(form,'');
  try { await fn(); } catch(error) { message(form,error.message || 'Something went wrong. Please try again.'); }
  finally { button.disabled=false;button.innerHTML=text; }
}

export function openMemberArea() {
  if (!configured) {
    shell('A space for our people.', 'Member access will open when the lab is ready.', `<div class="setup-message">${icon('user')}<p>Sign in to update your profile, choose research interests, and share photos with the lab.</p><p>The member service has not been connected yet. Please check back or contact the lab administrator.</p></div><button class="button dark full" disabled>Member access coming soon</button>`);
  } else if (passwordRecovery && user) renderPassword();
  else if (user) renderAccount();
  else renderAuth('login');
}

function renderAuth(mode) {
  const reset=mode==='reset', signup=mode==='signup';
  shell(reset?'Let’s get you back in.':signup?'Join the member space.':'Welcome back.',reset?'We’ll email you a link to reset your password.':signup?'Create an account. Lab approval is required before you can publish.':'Sign in to keep your profile and lab moments up to date.',`
    <form id="auth-form" class="stack-form">
      <label>Email<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"/></label>
      ${!reset?`<label>Password<input name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" ${signup?'minlength="12"':''} required placeholder="${signup?'At least 12 characters':'Your password'}"/></label>`:''}
      ${signup?'<p class="field-hint">Account email is private. You can choose a separate email to display publicly.</p>':''}
      ${feedback()}<button type="submit" class="button dark full">${reset?'Send reset link':signup?'Create account':'Sign in'} ${icon('arrow')}</button>
    </form>
    <div class="auth-links">${mode==='login'?'<button class="text-link" data-auth="reset">Forgot password?</button><button class="text-link" data-auth="signup">Create an account</button>':'<button class="text-link" data-auth="login">Back to sign in</button>'}</div>`);
  dialog.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>renderAuth(b.dataset.auth));
  dialog.querySelector('form').onsubmit=(event)=>{
    event.preventDefault();const form=event.currentTarget;
    submitting(form,async()=>{
      const fields = new FormData(form), email=fields.get('email').trim(), password=fields.get('password');
      if(reset){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/?account=recovery`});if(error)throw error;message(form,'If this email has an account, a reset link is on its way. Check your inbox and spam folder.',true);}
      else if(signup){const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}/`}});if(error)throw error;if(data.session){user=data.user;await renderAccount();}else message(form,'Check your email to confirm your account. An administrator will then review your membership.',true);}
      else {const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;user=data.user;await renderAccount();}
    });
  };
}

function renderPassword() {
  shell('Set your password.', 'Choose a password of at least 12 characters.', `<form class="stack-form"><label>New password<input name="password" type="password" minlength="12" autocomplete="new-password" required/></label><label>Confirm password<input name="confirmation" type="password" minlength="12" autocomplete="new-password" required/></label>${feedback()}<button type="submit" class="button dark full">Save password ${icon('check')}</button></form>`);
  dialog.querySelector('form').onsubmit=(event)=>{event.preventDefault();const form=event.currentTarget;submitting(form,async()=>{
    const fields=new FormData(form);if(fields.get('password')!==fields.get('confirmation'))throw new Error('Passwords do not match.');
    const {error}=await supabase.auth.updateUser({password:fields.get('password')});if(error)throw error;passwordRecovery=false;history.replaceState({},'',location.pathname);hooks.toast('Your password has been updated.');await renderAccount();
  });};
}

async function signOut() {
  const {error}=await supabase.auth.signOut();if(error){hooks.toast('Could not sign out. Please try again.');return;}
  user=null;account=null;passwordRecovery=false;renderAuth('login');hooks.toast('You have signed out.');
}

async function renderAccount() {
  const version=++accountVersion;
  shell('Your member space.', 'Loading your profile…', '<div class="loading-state" role="status">Loading…</div>');
  try {
    const result=await loadAccount(user.id);
    if(version!==accountVersion||!user||!dialog.open)return;
    account=result;
    if(!account.approved){
      const suspended=account.status==='suspended';
      shell(suspended?'Member access is suspended.':'You’re almost here.',suspended?'Contact a lab administrator to review your access.':'Your account is ready. Your membership is awaiting administrator approval.',`<div class="setup-message"><p>${suspended?'Access is currently suspended for':'Your membership request is registered for'} <strong>${e(user.email)}</strong>. Once approved, you can publish your profile and share photos.</p></div><div class="button-row"><button class="button dark" id="check-approval">Check approval ${icon('arrow')}</button><button class="text-link" id="sign-out">Sign out</button></div>${feedback()}`);dialog.querySelector('#check-approval').onclick=renderAccount;dialog.querySelector('#sign-out').onclick=signOut;return;
    }
    renderEditor();
  }catch(error){if(version!==accountVersion)return;shell('Unable to load your profile.', 'Please try again in a moment.',`<p class="form-feedback">${e(error.message)}</p><div class="button-row"><button class="button dark" id="retry-account">Try again</button><button class="text-link" id="sign-out">Sign out</button></div>`);dialog.querySelector('#retry-account').onclick=renderAccount;dialog.querySelector('#sign-out').onclick=signOut;}
}

function profileValues(form) {
  const fields=new FormData(form);
  return {full_name:fields.get('full_name').trim(),program:fields.get('program'),interests:normalizeKeywords(keywords),linkedin_url:validateSocialUrl(fields.get('linkedin_url'),'linkedin'),scholar_url:validateSocialUrl(fields.get('scholar_url'),'scholar'),github_url:validateSocialUrl(fields.get('github_url'),'github'),public_email:fields.get('public_email').trim(),published:fields.has('published'),removePhoto:fields.has('remove_photo')};
}

function renderEditor() {
  const profile=account.profile||{};keywords=[...(profile.interests||[])];
  const input=(label,name,placeholder='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${e(profile[name]||'')}" placeholder="${placeholder}" maxlength="${type==='url'?500:254}"/></label>`;
  shell('Make yourself known.', 'Your profile, your interests, your corner of the lab.',`
    <div class="account-toolbar"><span>${e(user.email)}</span>${account.role==='admin'?'<button class="text-link" id="open-admin">Manage members</button>':''}<button class="text-link" id="change-password">Change password</button><button class="text-link" id="sign-out">Sign out</button></div>
    <div class="editor-layout"><form id="profile-form" class="stack-form">
      <div class="form-section-title"><span>01</span><h3>The essentials</h3></div>
      <div class="form-columns"><label>Full name<input name="full_name" value="${e(profile.full_name||'')}" required maxlength="100" autocomplete="name" placeholder="Your name in English"/></label><label>Position / program<select name="program" required>${programs.map(p=>`<option value="${p.value}" ${(profile.program||'ms')===p.value?'selected':''}>${p.label}</option>`).join('')}</select></label></div>
      <label class="upload-label">${icon('upload')}<span>Choose profile photo<small>JPG, PNG, or WebP · up to 5 MB</small></span><input type="file" name="avatar" accept="image/jpeg,image/png,image/webp"/></label><span id="selected-file-name" class="field-hint"></span><p class="field-hint">Uploaded photos are public website assets. Only upload photos you are comfortable sharing.</p>
      ${profile.avatar_path?'<label class="check-label"><input type="checkbox" name="remove_photo"/>Remove current profile photo</label>':''}
      <div class="form-section-title"><span>02</span><h3>Research interests</h3></div><p class="field-hint">Tap to select up to 8 keywords. You can add your own.</p><div id="keyword-options" class="keyword-options" role="group" aria-label="Research interests"></div>
      <div class="custom-keyword"><input id="custom-keyword" placeholder="Add a research interest" maxlength="40" aria-label="Custom research interest"/><button type="button" class="button outline" id="add-keyword">Add</button></div>
      <div class="form-section-title"><span>03</span><h3>Stay connected</h3></div>
      ${input('LinkedIn URL','linkedin_url','https://www.linkedin.com/in/your-name','url')}${input('Google Scholar URL','scholar_url','https://scholar.google.com/citations?user=…','url')}${input('GitHub URL','github_url','https://github.com/your-name','url')}${input('Public email (optional)','public_email','Email to display on your profile','email')}
      <p class="field-hint">Only links and an email you enter here will appear below your photo.</p>
      <label class="check-label publish-check"><input type="checkbox" name="published" ${profile.published?'checked':''}/><span>Publish my profile on the lab website<small>Your photo, interests, links, and public email will be visible to everyone.</small></span></label>
      ${feedback()}<button type="submit" class="button dark full">Save profile ${icon('check')}</button>
    </form><aside class="profile-preview"><p class="eyebrow">PROFILE PREVIEW</p><div id="profile-preview-card"></div><p class="field-hint">A preview of how your profile appears to visitors.</p></aside></div>
    <section class="gallery-editor"><div class="form-section-title"><span>04</span><h3>Share a lab moment</h3></div><p class="field-hint">Uploaded photos and captions are public. Share photos you have permission to publish.</p><form id="gallery-form" class="stack-form"><label>Photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required/></label><label>Caption & image description<input name="caption" required maxlength="240" placeholder="Describe this lab moment"/></label>${feedback()}<button type="submit" class="button outline">Publish photo ${icon('upload')}</button></form><div id="my-photos" class="my-photos"></div></section>`,true);
  dialog.querySelector('#sign-out').onclick=signOut;
  dialog.querySelector('#open-admin')?.addEventListener('click',()=>{dialog.close();hooks.navigate('/admin/');});
  dialog.querySelector('#change-password').onclick=()=>{passwordRecovery=true;renderPassword();};
  const form=dialog.querySelector('#profile-form');
  function updatePreview(){
    const fields=new FormData(form);
    const preview={full_name:fields.get('full_name')||'Your name',program:fields.get('program'),interests:keywords,linkedin_url:fields.get('linkedin_url'),scholar_url:fields.get('scholar_url'),github_url:fields.get('github_url'),public_email:fields.get('public_email'),avatar_path:fields.has('remove_photo')?null:profile.avatar_path};
    dialog.querySelector('#profile-preview-card').innerHTML=hooks.memberCard(preview);
    if(photoPreview){const holder=dialog.querySelector('.profile-preview .member-photo');holder.innerHTML='<img alt="Your selected profile photo"/>';holder.querySelector('img').src=photoPreview;}
  }
  function renderKeywords(){
    const all=[...new Set([...suggestedKeywords,...keywords])];
    dialog.querySelector('#keyword-options').innerHTML=all.map(k=>`<button type="button" class="keyword ${keywords.includes(k)?'selected':''}" data-keyword="${e(k)}" aria-pressed="${keywords.includes(k)}">${keywords.includes(k)?icon('check'):''}${e(k)}</button>`).join('');updatePreview();
  }
  dialog.querySelector('#keyword-options').onclick=(event)=>{const button=event.target.closest('[data-keyword]');if(!button)return;try{keywords=normalizeKeywords(keywords.includes(button.dataset.keyword)?keywords.filter(k=>k!==button.dataset.keyword):[...keywords,button.dataset.keyword]);message(form,'');renderKeywords();}catch(error){message(form,error.message);}};
  const addKeyword=()=>{const field=dialog.querySelector('#custom-keyword');try{keywords=normalizeKeywords([...keywords,field.value]);field.value='';message(form,'');renderKeywords();}catch(error){message(form,error.message);}};
  dialog.querySelector('#add-keyword').onclick=addKeyword;
  dialog.querySelector('#custom-keyword').onkeydown=(event)=>{if(event.key==='Enter'){event.preventDefault();addKeyword();}};
  form.addEventListener('input', updatePreview);
  form.elements.avatar.onchange=()=>{releasePreview();const file=form.elements.avatar.files[0];try{if(file){validateImage(file);selectedPhoto=file;photoPreview=URL.createObjectURL(file);if(form.elements.remove_photo)form.elements.remove_photo.checked=false;}dialog.querySelector('#selected-file-name').textContent=file?.name||'';message(form,'');updatePreview();}catch(error){form.elements.avatar.value='';dialog.querySelector('#selected-file-name').textContent='';message(form,error.message);updatePreview();}};
  if(form.elements.remove_photo)form.elements.remove_photo.onchange=()=>{if(form.elements.remove_photo.checked){releasePreview();form.elements.avatar.value='';dialog.querySelector('#selected-file-name').textContent='';}updatePreview();};
  form.onsubmit=(event)=>{event.preventDefault();submitting(form,async()=>{
    const values=profileValues(form);if(!values.full_name)throw new Error('Please enter your name.');
    account.profile=await saveProfile(user.id,values,selectedPhoto,profile.avatar_path);
    await hooks.refreshPublicData();renderEditor();hooks.toast(values.published?'Your profile is now published.':'Your profile is saved as a draft and is not listed on the website.');
  });};
  const galleryForm=dialog.querySelector('#gallery-form');
  galleryForm.onsubmit=(event)=>{event.preventDefault();submitting(galleryForm,async()=>{
    const fields=new FormData(galleryForm),caption=fields.get('caption').trim();if(!caption)throw new Error('Please add a caption.');
    await addGalleryPhoto(user.id,fields.get('photo'),caption);galleryForm.reset();message(galleryForm,'Your photo is published.',true);await hooks.refreshPublicData();await renderMyPhotos();
  });};
  renderKeywords();renderMyPhotos();
}

async function renderMyPhotos() {
  const target=dialog.querySelector('#my-photos');if(!target||!user)return;
  const {data,error}=await supabase.from('gallery_photos').select('*').eq('owner_id',user.id).order('created_at',{ascending:false});
  if(!target.isConnected)return;
  if(error){target.textContent='Could not load your photos. Reopen the member area to try again.';return;}
  target.innerHTML=data.length?`<h4>Your published photos</h4><div class="my-photo-grid">${data.map(photo=>`<figure><img src="${e(assetUrl(photo.image_path))}" alt="${e(photo.caption)}"/><figcaption>${e(photo.caption)}</figcaption><button class="text-link danger" data-delete="${photo.id}">Delete photo</button></figure>`).join('')}</div>`:'<p class="field-hint">Your uploaded lab photos will appear here.</p>';
  target.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
    if(button.dataset.confirm!=='true'){button.dataset.confirm='true';button.textContent='Confirm delete';return;}
    button.disabled=true;
    try{await deleteGalleryPhoto(data.find(p=>p.id===button.dataset.delete));await hooks.refreshPublicData();await renderMyPhotos();hooks.toast('Photo deleted.');}catch(error){hooks.toast(error.message);button.disabled=false;}
  });
}

export function initializeMembers(callbacks) {
  hooks=callbacks;
  dialog.addEventListener('close',()=>{++accountVersion;releasePreview();});
  if(!supabase)return;
  supabase.auth.onAuthStateChange((event,session)=>{
    const previous=user?.id;user=session?.user||null;
    document.querySelector('.member-access span').textContent=user?'My profile':'Member login';
    // Defer any Supabase calls until the auth callback releases its lock.
    setTimeout(()=>{
      hooks.onAccountChange?.();
      if(event==='PASSWORD_RECOVERY'){passwordRecovery=true;renderPassword();}
      else if(event==='INITIAL_SESSION'&&user&&passwordRecovery)renderPassword();
      else if(event==='SIGNED_OUT'){account=null;++accountVersion;if(dialog.open)renderAuth('login');}
      else if(previous&&user?.id!==previous&&dialog.open)openMemberArea();
    },0);
  });
  const error=incoming.get('error_description');
  if(error){hooks.toast(error);history.replaceState({},'',location.pathname);passwordRecovery=false;}
}
