import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';

const base='http://127.0.0.1:5175';
const connected='http://127.0.0.1:5174';
const uid='11111111-1111-4111-8111-111111111111';
const png=readFileSync(new URL('../../logo.png',import.meta.url));
const account={id:uid,aud:'authenticated',role:'authenticated',email:'tester@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:new Date().toISOString()};
const token=()=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.test-signature`;

async function mockBackend(page,{approved=true,admin=false,failSave=false,failUpload=false}={}){
  const state={profile:null,photos:[],uploads:0,removed:0,signup:0,recovery:0,passwordUpdates:0,changes:[],accounts:[
    {user_id:uid,email:account.email,full_name:'Test Administrator',email_verified:true,role:admin?'admin':'member',status:approved?'approved':'pending'},
    {user_id:'22222222-2222-4222-8222-222222222222',email:'new@example.com',full_name:null,email_verified:true,role:'member',status:'pending'},
    {user_id:'33333333-3333-4333-8333-333333333333',email:'unverified@example.com',full_name:null,email_verified:false,role:'member',status:'pending'},
  ]};
  await page.route('https://test-project.supabase.co/**',async route=>{
    const req=route.request(), url=new URL(req.url()), path=url.pathname, method=req.method();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(path.endsWith('/auth/v1/token'))return json({access_token:token(),refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:account});
    if(path.endsWith('/auth/v1/user')){if(method==='PUT')state.passwordUpdates++;return json(account);}
    if(path.endsWith('/auth/v1/logout'))return route.fulfill({status:204});
    if(path.endsWith('/auth/v1/signup')){state.signup++;return json({user:account,session:null});}
    if(path.endsWith('/auth/v1/recover')){state.recovery++;return json({});}
    if(path.endsWith('/rest/v1/rpc/current_membership'))return json(state.accounts[0]);
    if(path.endsWith('/rest/v1/rpc/list_memberships')){
      if(state.accounts[0].role!=='admin')return json({message:'Administrator access required.'},403);
      const search=req.postDataJSON().p_search.toLowerCase(),members=state.accounts.filter(a=>(a.email+' '+a.full_name).toLowerCase().includes(search));
      return json({members,total:members.length});
    }
    if(path.endsWith('/rest/v1/rpc/set_membership')){
      const body=req.postDataJSON(),target=state.accounts.find(a=>a.user_id===body.p_user_id);
      if(target.role==='admin'&&(body.p_role!=='admin'||body.p_status!=='approved')&&state.accounts.filter(a=>a.role==='admin'&&a.status==='approved').length===1)return json({message:'Keep at least one approved administrator. Promote another member first.'},400);
      state.changes.push(body);target.role=body.p_role;target.status=body.p_status;return json(target);
    }
    if(path.endsWith('/rest/v1/profiles')){
      if(method==='POST'){
        if(failSave)return json({message:'Profile could not be saved. Please try again.',code:'TEST'},500);
        state.profile=req.postDataJSON();return json(state.profile,201);
      }
      if(url.searchParams.has('id'))return json(state.profile);
      return json(state.profile?.published?[state.profile]:[]);
    }
    if(path.endsWith('/rest/v1/gallery_photos')){
      if(method==='POST'){const photo={...req.postDataJSON(),id:'gallery-1',created_at:new Date().toISOString()};state.photos.push(photo);return json(photo,201);}
      if(method==='DELETE'){state.photos=[];return json([{id:'gallery-1'}]);}
      return json(state.photos);
    }
    if(path.includes('/storage/v1/object/public/'))return route.fulfill({contentType:'image/png',body:png});
    if(path.includes('/storage/v1/object/')){
      if(method==='POST'){if(failUpload)return json({statusCode:'403',error:'Unauthorized',message:'Upload denied'},403);state.uploads++;return json({Key:path.split('/object/')[1]},200);}
      if(method==='DELETE'){state.removed++;return json([]);}
    }
    return json({message:'Unexpected test request: '+method+' '+path},500);
  });
  return state;
}
async function login(page){
  await page.goto(connected);
  await page.locator('.member-access').click();
  await page.getByLabel('Email',{exact:true}).fill('tester@example.com');
  await page.getByLabel('Password',{exact:true}).fill('test-password-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}

test('public desktop page has six destinations, no invented records, and an honest unconfigured login',async({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base);
  await expect(page.getByRole('heading',{name:'From data. To discovery.'})).toBeVisible();
  await expect(page.locator('#main-nav a')).toHaveCount(6);
  await expect(page.locator('.member-card')).toHaveCount(0);
  await expect(page.locator('#member-list')).toHaveCount(0);
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  await page.locator('.member-access').click();
  await expect(page.getByRole('button',{name:'Member access coming soon'})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.locator('#member-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('each destination has its own page with direct links, reload, and browser history',async({page})=>{
  await page.goto(base);
  await page.locator('#main-nav a[href="/members/"]').click();
  await expect(page).toHaveURL(base+'/members/');
  await expect(page.locator('main')).toHaveAttribute('data-page','members');
  await expect(page.locator('#member-list .member-group')).toHaveCount(4);
  await expect(page.locator('#research')).toHaveCount(0);
  await expect(page.locator('#main-nav a[aria-current="page"]')).toHaveText('Members');
  await page.reload();await expect(page.locator('#member-list .member-group')).toHaveCount(4);
  await page.locator('#main-nav a[href="/research/"]').click();
  await expect(page.locator('#research')).toBeVisible();await expect(page.locator('#member-list')).toHaveCount(0);
  await page.goBack();await expect(page.locator('main')).toHaveAttribute('data-page','members');
  await page.goForward();await expect(page.locator('main')).toHaveAttribute('data-page','research');
  for(const route of ['publications','news','apply']){
    await page.goto(base+'/'+route+'/');await expect(page.locator('main')).toHaveAttribute('data-page',route);
    await expect(page.locator('h1')).toBeVisible();
  }
  await expect(page.locator('iframe[title*="Google Maps"]')).toHaveAttribute('src',/output=embed/);
  await page.goto(base+'/#members');await expect(page).toHaveURL(base+'/members/');
  await page.screenshot({path:'test-results/members-desktop.png',fullPage:true});
  await page.goto(base+'/#contact');await expect(page).toHaveURL(base+'/apply/#contact');
  await expect(page.locator('#contact')).toBeVisible();
  await page.goto(base+'/unknown/');await expect(page.getByRole('heading',{name:'This page is still undiscovered.'})).toBeVisible();
});

test('phone, tablet, and desktop layouts fit with working program filters and navigation',async({page})=>{
  for(const width of [360,390,768,1024,1920]){
    await page.setViewportSize({width,height:900});await page.goto(base);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    if(width<901){await page.getByRole('button',{name:'Open navigation'}).click();await page.locator('#main-nav').getByRole('link',{name:'Members',exact:true}).click();await expect(page.locator('#main-nav')).not.toBeVisible();}
    else await page.locator('#main-nav').getByRole('link',{name:'Members',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.getByRole('button',{name:'B.S.–M.S.',exact:true}).click();
    await expect(page.locator('#member-list .member-group')).toHaveCount(1);
    await expect(page.locator('#member-list')).toContainText('Combined B.S.–M.S.');
    await page.getByRole('button',{name:'All members',exact:true}).click();
    await expect(page.locator('#member-list .member-group')).toHaveCount(4);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base);
  await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
});

test('approved member publishes a photo, program, keywords, social icons and public email, then unpublishes',async({page})=>{
  const state=await mockBackend(page);const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await login(page);await expect(page.getByLabel('Full name')).toBeVisible();
  await page.getByLabel('Full name').fill('Test Researcher');
  await page.getByRole('combobox',{name:'Position / program',exact:true}).selectOption('bsms');
  await page.getByRole('button',{name:'Machine Learning',exact:true}).click();
  await page.getByLabel('Custom research interest').fill('Graph Mining');await page.getByRole('button',{name:'Add',exact:true}).click();
  await page.getByLabel('LinkedIn URL').fill('https://www.linkedin.com/in/test-researcher');
  await page.getByLabel('Google Scholar URL').fill('https://scholar.google.com/citations?user=test');
  await page.getByLabel('GitHub URL').fill('https://github.com/test-researcher');
  await page.getByLabel('Public email (optional)').fill('public@example.com');
  await page.locator('input[name="avatar"]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('#profile-preview-card img[alt="Your selected profile photo"]')).toBeVisible();
  await page.getByLabel('Publish my profile on the lab website').check();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Your profile is now published.'})).toBeVisible();
  expect(state.uploads).toBe(1);expect(state.profile.program).toBe('bsms');expect(state.profile.interests).toEqual(['Machine Learning','Graph Mining']);
  await page.getByRole('button',{name:'Close member area'}).click();
  await page.locator('#main-nav').getByRole('link',{name:'Members',exact:true}).click();
  const card=page.locator('#member-list .member-card');
  await expect(card).toHaveCount(1);await expect(card).toContainText('Test Researcher');
  await expect(card.locator('.social-links a')).toHaveCount(3);
  await expect(card.getByRole('link',{name:'public@example.com'})).toHaveAttribute('href','mailto:public@example.com');
  await expect(card).not.toContainText('tester@example.com');
  await page.locator('.member-access').click();await page.getByLabel('Publish my profile on the lab website').uncheck();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('saved as a draft');
  await page.getByRole('button',{name:'Close member area'}).click();await expect(page.locator('#member-list .member-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('faculty profiles publish under Professors and filter separately from student programs',async({page})=>{
  const state=await mockBackend(page);
  await login(page);
  const position=page.getByRole('combobox',{name:'Position / program',exact:true});
  await expect(position).toHaveValue('ms');
  await page.getByLabel('Full name').fill('Test Professor');
  await position.selectOption('faculty');
  await page.getByLabel('Publish my profile on the lab website').check();
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.locator('#toast')).toContainText('Your profile is now published.');
  expect(state.profile.program).toBe('faculty');
  await page.getByRole('button',{name:'Close member area'}).click();
  await page.locator('#main-nav').getByRole('link',{name:'Members',exact:true}).click();
  const faculty=page.locator('[data-member-group="faculty"]');
  await expect(faculty.locator('.member-card')).toContainText('Test Professor');
  await expect(faculty.locator('.member-details .small-label')).toHaveText('Professor');
  await page.getByRole('button',{name:'Faculty',exact:true}).click();
  await expect(page.locator('.member-group')).toHaveCount(1);
  await page.getByRole('button',{name:'M.S.',exact:true}).click();
  await expect(page.locator('#member-list .member-card')).toHaveCount(0);
  await page.goto(connected+'/apply/');
  await expect(page.locator('.apply-programs h3')).toHaveCount(3);
  await expect(page.locator('.apply-programs')).not.toContainText('Faculty');
});

test('mobile member editor publishes and deletes a gallery photo and persists session',async({page})=>{
  await page.setViewportSize({width:390,height:844});const state=await mockBackend(page);
  await page.goto(connected);await page.getByRole('button',{name:'Open navigation'}).click();await page.locator('.member-access').click();
  await page.getByLabel('Email',{exact:true}).fill('tester@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByLabel('Full name')).toBeVisible();
  expect(await page.locator('#member-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
  await page.locator('#gallery-form input[type=file]').setInputFiles({name:'lab.png',mimeType:'image/png',buffer:png});
  await page.getByLabel('Caption & image description').fill('A test lab moment');await page.getByRole('button',{name:'Publish photo',exact:true}).click();
  await expect(page.locator('#my-photos')).toContainText('A test lab moment');expect(state.photos).toHaveLength(1);
  await page.getByRole('button',{name:'Delete photo',exact:true}).click();await page.getByRole('button',{name:'Confirm delete',exact:true}).click();
  await expect(page.locator('#toast')).toHaveText('Photo deleted.');expect(state.photos).toHaveLength(0);expect(state.removed).toBe(1);
  await page.reload();await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.locator('.member-access')).toContainText('My profile');
});

test('pending membership cannot reach the editor',async({page})=>{
  await mockBackend(page,{approved:false});await login(page);await expect(page.getByRole('heading',{name:'You’re almost here.'})).toBeVisible();await expect(page.getByLabel('Full name')).toHaveCount(0);await page.getByRole('button',{name:'Check approval'}).click();await expect(page.getByRole('heading',{name:'You’re almost here.'})).toBeVisible();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
});

test('signup, password reset, and password change provide real success or validation states',async({page})=>{
  const state=await mockBackend(page);await page.goto(connected);await page.locator('.member-access').click();await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('tester@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.locator('.form-feedback')).toContainText('Check your email');expect(state.signup).toBe(1);
  await page.getByRole('button',{name:'Back to sign in'}).click();await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email',{exact:true}).fill('tester@example.com');await page.getByRole('button',{name:'Send reset link'}).click();await expect(page.locator('.form-feedback')).toContainText('reset link is on its way');expect(state.recovery).toBe(1);
  await page.getByRole('button',{name:'Close member area'}).click();await login(page);await page.getByRole('button',{name:'Change password'}).click();await page.getByLabel('New password',{exact:true}).fill('new-password-123');await page.getByLabel('Confirm password',{exact:true}).fill('different-password');await page.getByRole('button',{name:'Save password'}).click();await expect(page.locator('.form-feedback')).toContainText('Passwords do not match');await page.getByLabel('Confirm password',{exact:true}).fill('new-password-123');await page.getByRole('button',{name:'Save password'}).click();await expect(page.getByLabel('Full name')).toBeVisible();expect(state.passwordUpdates).toBe(1);
});

test('failed profile save keeps the form and cleans up its new image',async({page})=>{
  const state=await mockBackend(page,{failSave:true});await login(page);await page.getByLabel('Full name').fill('Test Member');await page.locator('input[name="avatar"]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.locator('#profile-form .form-feedback')).toContainText('Profile could not be saved');await expect(page.getByLabel('Full name')).toHaveValue('Test Member');expect(state.uploads).toBe(1);expect(state.removed).toBe(1);expect(state.profile).toBeNull();
});

test('upload errors are visible and do not create gallery records',async({page})=>{
  const state=await mockBackend(page,{failUpload:true});await login(page);await page.locator('#gallery-form input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await page.getByLabel('Caption & image description').fill('Test');await page.getByRole('button',{name:'Publish photo',exact:true}).click();await expect(page.locator('#gallery-form .form-feedback')).toContainText('Upload denied');expect(state.photos).toHaveLength(0);
});

test('administration rejects visitors and regular members',async({page})=>{
  await mockBackend(page);await page.goto(connected+'/admin/');
  await expect(page.getByRole('heading',{name:'Administrator sign in'})).toBeVisible();
  await login(page);await expect(page.getByLabel('Full name')).toBeVisible();
  await page.getByRole('button',{name:'Close member area'}).click();await page.goto(connected+'/admin/');
  await expect(page.getByRole('heading',{name:'Administrator access required.'})).toBeVisible();
  await expect(page.locator('#admin-roster')).toHaveCount(0);
});

test('administrator approves members, assigns roles, suspends access, and sees last-admin errors',async({page})=>{
  const state=await mockBackend(page,{admin:true});await login(page);
  await page.getByRole('button',{name:'Manage members'}).click();
  await expect(page).toHaveURL(connected+'/admin/');await expect(page.locator('.admin-account')).toHaveCount(3);
  const own=page.locator(`form[data-account="${uid}"]`);
  await own.getByRole('combobox',{name:'Role for tester@example.com'}).selectOption('member');
  await own.getByRole('button',{name:'Save access'}).click();
  await expect(own.locator('.account-feedback')).toContainText('Keep at least one');
  await expect(page.getByRole('combobox',{name:'Access for unverified@example.com'}).locator('option[value="approved"]')).toHaveJSProperty('disabled',true);
  let request=page.locator('form[data-account="22222222-2222-4222-8222-222222222222"]');
  await request.getByRole('combobox',{name:'Access for new@example.com'}).selectOption('approved');
  await request.getByRole('button',{name:'Save access'}).click();
  await expect(page.locator('#toast')).toHaveText('Account access updated.');
  expect(state.changes[0].p_status).toBe('approved');
  await request.getByRole('combobox',{name:'Role for new@example.com'}).selectOption('admin');
  await request.getByRole('button',{name:'Save access'}).click();
  expect(state.changes).toHaveLength(1);
  await request.getByRole('button',{name:'Confirm change'}).click();
  await expect(request.getByRole('combobox',{name:'Role for new@example.com'})).toHaveValue('admin');
  await expect(request.getByRole('button',{name:'Save access'})).toBeEnabled();
  expect(state.changes[1].p_role).toBe('admin');
  await page.getByRole('searchbox',{name:'Search accounts'}).fill('new@example.com');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.admin-account')).toHaveCount(1);
  await request.getByRole('combobox',{name:'Access for new@example.com'}).selectOption('suspended');
  await request.getByRole('button',{name:'Save access'}).click();await request.getByRole('button',{name:'Confirm change'}).click();
  await expect(request.getByRole('combobox',{name:'Access for new@example.com'})).toHaveValue('suspended');
  await expect(request.getByRole('button',{name:'Save access'})).toBeEnabled();
  expect(state.changes[2].p_status).toBe('suspended');
  await page.getByRole('searchbox',{name:'Search accounts'}).fill('');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.admin-account')).toHaveCount(3);
  await page.screenshot({path:'test-results/admin-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});
});

for (const type of ['recovery','invite']) {
  test(`${type} email callback opens password setup and clears the callback URL`,async({page})=>{
    const state=await mockBackend(page);
    await page.goto(`${connected}/#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=${type}`);
    await expect(page.getByRole('heading',{name:'Set your password.'})).toBeVisible();
    await page.getByLabel('New password',{exact:true}).fill('new-password-123');
    await page.getByLabel('Confirm password',{exact:true}).fill('new-password-123');
    await page.getByRole('button',{name:'Save password'}).click();
    await expect(page.getByLabel('Full name')).toBeVisible();
    expect(state.passwordUpdates).toBe(1);expect(new URL(page.url()).hash).toBe('');
  });
}
