import { configured, supabase, loadAccount, listMemberships, setMembership } from './api.js';
import { escapeHtml as e } from './validation.js';
import { icon } from './icons.js';

let version=0;
export async function renderAdminPage({toast,refreshPublicData}) {
  const host=document.querySelector('#admin-content');
  if(!host)return;
  const request=++version;
  const isCurrent=()=>request===version&&host.isConnected;
  host.innerHTML='<div class="loading-state" role="status">Checking administrator access…</div>';
  if(!configured){host.innerHTML='<div class="admin-access-message"><h2>Administration is not connected yet.</h2><p>The lab administrator can connect the member service to enable approval and role management.</p></div>';return;}
  try {
    const {data,error}=await supabase.auth.getUser();
    if(!isCurrent())return;
    if(error||!data.user){host.innerHTML='<div class="admin-access-message"><h2>Administrator sign in</h2><p>Sign in with your lab administrator account to review membership requests.</p><button class="button dark" data-member-open>Sign in</button></div>';return;}
    const current=await loadAccount(data.user.id);
    if(!isCurrent())return;
    if(!current.approved||current.role!=='admin'){host.innerHTML='<div class="admin-access-message"><h2>Administrator access required.</h2><p>This page is available to approved lab administrators. Your member profile is available in the member area.</p><button class="button outline" data-member-open>Open member area</button></div>';return;}
    host.innerHTML=`<div class="admin-heading"><div><p class="eyebrow">PEOPLE & PERMISSIONS</p><h2>Manage lab access.</h2><p class="section-description">Approve verified accounts and assign member or administrator roles.</p></div><span class="role-badge">${icon('check')} Administrator</span></div><form class="admin-search"><label class="search-field">${icon('search')}<input type="search" name="search" placeholder="Search by name or email" aria-label="Search accounts" maxlength="100"/></label><button type="submit" class="button outline">Search</button><button type="button" class="text-link" id="refresh-accounts">Refresh</button></form><p class="form-feedback" id="admin-feedback" role="status"></p><div id="admin-roster"></div><div class="admin-pagination"><button class="button outline" id="previous-accounts">Previous</button><span id="account-page-label"></span><button class="button outline" id="next-accounts">Next</button></div><p class="section-note">Administrators can approve accounts, change roles, and suspend access. At least one approved administrator must remain. Email verification is required before approval.</p>`;
    let search='',page=1,total=0;
    const roster=host.querySelector('#admin-roster'),feedback=host.querySelector('#admin-feedback');
    let listingVersion=0;
    async function load(){
      const loadVersion=++listingVersion;
      roster.innerHTML='<div class="loading-state" role="status">Loading accounts…</div>';
      feedback.textContent='';
      host.querySelector('#previous-accounts').disabled=true;host.querySelector('#next-accounts').disabled=true;
      try{
        const result=await listMemberships(search,page);
        if(!isCurrent()||loadVersion!==listingVersion)return;
        total=result.total;
        roster.innerHTML=result.members.length?`<div class="admin-account-list">${result.members.map(member=>`<form class="admin-account" data-account="${member.user_id}"><div class="account-identity"><span class="account-avatar">${e((member.full_name||member.email||'?')[0].toUpperCase())}</span><div><h3>${e(member.full_name||'New lab account')}${member.user_id===data.user.id?' <small>You</small>':''}</h3><p>${e(member.email)}</p><span class="account-verification ${member.email_verified?'verified':''}">${member.email_verified?'Email verified':'Waiting for email verification'}</span></div></div><div class="account-controls"><label>Role<select name="role" aria-label="Role for ${e(member.email)}"><option value="member" ${member.role==='member'?'selected':''}>Member</option><option value="admin" ${member.role==='admin'?'selected':''}>Administrator</option></select></label><label>Access<select name="status" aria-label="Access for ${e(member.email)}"><option value="pending" ${member.status==='pending'?'selected':''}>Pending approval</option><option value="approved" ${member.status==='approved'?'selected':''} ${member.email_verified?'':'disabled'}>Approved</option><option value="suspended" ${member.status==='suspended'?'selected':''}>Suspended</option></select></label><button type="submit" class="button dark">Save access</button></div><p class="form-feedback account-feedback" role="status"></p></form>`).join('')}</div>`:'<div class="empty-state"><h3>No matching accounts.</h3><p>New signups will appear here for review.</p></div>';
        host.querySelector('#account-page-label').textContent=`Page ${page} of ${Math.max(1,Math.ceil(total/20))} · ${total} account${total===1?'':'s'}`;
        host.querySelector('#previous-accounts').disabled=page<=1;host.querySelector('#next-accounts').disabled=page*20>=total;
        roster.querySelectorAll('form[data-account]').forEach(form=>form.onsubmit=async event=>{
          event.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;
          const original=result.members.find(member=>member.user_id===form.dataset.account),fields=new FormData(form);
          const role=fields.get('role'),status=fields.get('status'),notice=form.querySelector('.account-feedback');
          // Make privilege changes explicit and reviewable before committing them.
          const changeKey=`${role}:${status}`;
          if((role==='admin'&&original.role!=='admin')||(status!=='approved'&&original.status==='approved')){
            if(button.dataset.confirm!==changeKey){button.dataset.confirm=changeKey;button.textContent='Confirm change';notice.textContent=`Confirm ${role==='admin'?'administrator':'member'} role with ${status} access for ${original.email}.`;return;}
          }
          button.disabled=true;button.textContent='Saving…';notice.textContent='';
          try{
            await setMembership(original.user_id,role,status);
            if(!isCurrent())return;
            await refreshPublicData();toast('Account access updated.');
            if(original.user_id===data.user.id&&(role!=='admin'||status!=='approved')){await renderAdminPage({toast,refreshPublicData});return;}
            await load();
          }catch(error){notice.textContent=error.message;button.disabled=false;button.textContent='Save access';delete button.dataset.confirm;}
        });
      }catch(error){if(isCurrent()){feedback.textContent=error.message;roster.innerHTML='<div class="empty-state"><p>Unable to load accounts. Use Refresh to try again.</p></div>';}}
    }
    host.querySelector('.admin-search').onsubmit=event=>{event.preventDefault();search=new FormData(event.currentTarget).get('search').trim();page=1;load();};
    host.querySelector('#refresh-accounts').onclick=load;
    host.querySelector('#previous-accounts').onclick=()=>{if(page>1){page--;load();}};
    host.querySelector('#next-accounts').onclick=()=>{if(page*20<total){page++;load();}};
    await load();
  } catch(error){if(isCurrent())host.innerHTML=`<div class="admin-access-message"><h2>Unable to check access.</h2><p>${e(error.message)}</p><button class="button outline" id="retry-admin">Try again</button></div>`;host.querySelector('#retry-admin')?.addEventListener('click',()=>renderAdminPage({toast,refreshPublicData}));}
}
