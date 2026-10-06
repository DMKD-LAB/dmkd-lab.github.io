// Read-only checks against the configured project; never creates users or sends email.
import { existsSync } from 'node:fs';

if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const url=process.env.VITE_SUPABASE_URL;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key?.startsWith('sb_publishable_'))throw new Error('Set the project URL and publishable key in .env.local first.');

const checks=[
  ['auth','/auth/v1/settings'],
  ['profiles','/rest/v1/profiles?select=id&limit=1'],
  ['gallery','/rest/v1/gallery_photos?select=id&limit=1'],
  ['membership_protection','/rest/v1/rpc/current_membership','POST'],
];
await Promise.all(checks.map(async([name,path,method='GET'])=>{
  try{
    const response=await fetch(new URL(path,url),{method,headers:{apikey:key,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    const summary={check:name,status:response.status};
    const expected=name==='membership_protection'?response.status===401&&data.code==='42501':response.ok;
    if(!expected)process.exitCode=1;
    if(name==='auth'&&response.ok){
      Object.assign(summary,{email_enabled:data.external?.email,signup_disabled:data.disable_signup,email_autoconfirm:data.mailer_autoconfirm});
    }else if(Array.isArray(data))summary.returned_rows=data.length;
    else Object.assign(summary,{code:data.code,message:data.message||data.msg||data.error});
    console.log(JSON.stringify(summary));
  }catch(error){console.log(JSON.stringify({check:name,error:error.message,cause:error.cause?.code}));process.exitCode=1;}
}));
