// Use the Git credential helper for this repository. Credentials stay in memory
// and are only sent to api.github.com; they are never printed or written to disk.
import { execFileSync, spawnSync } from 'node:child_process';
const repository='DMKD-LAB/dmkd-lab.github.io';
const remote=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
if(remote!==`https://github.com/${repository}.git`)throw new Error('Unexpected repository remote.');
const credentials=spawnSync('git',['credential','fill'],{
  input:`protocol=https\nhost=github.com\npath=${repository}.git\n\n`,encoding:'utf8',
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},
});
if(credentials.status!==0)throw new Error('No non-interactive GitHub credential is available. Sign in to GitHub through Git Credential Manager first.');
const password=credentials.stdout.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);
if(!password)throw new Error('GitHub credential helper returned no credential.');
async function api(path,method='GET',body,{optional=false}={}){
  const response=await fetch(`https://api.github.com${path}`,{method,redirect:'error',headers:{Authorization:`Bearer ${password}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=response.status===204?null:await response.json();
  if(optional&&response.status===404)return null;
  if(!response.ok)throw new Error(`GitHub ${method} ${path}: ${response.status} ${data?.message||''}`);
  return data;
}
const mode=process.argv[2]||'inspect';
if(mode==='inspect'){
  const [user,repo]=await Promise.all([api('/user'),api(`/repos/${repository}`)]);
  console.log(JSON.stringify({login:user.login,id:user.id,repository:repo.full_name,permissions:repo.permissions,has_pages:repo.has_pages,default_branch:repo.default_branch}));
}else if(mode==='configure-variables'){
  process.loadEnvFile('.env.local');
  const values={VITE_SUPABASE_URL:process.env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:process.env.VITE_SUPABASE_PUBLISHABLE_KEY};
  if(values.VITE_SUPABASE_URL!=='https://geqkimegnprqipooaqvr.supabase.co'||!values.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'))throw new Error('Expected the lab project URL and a publishable client key.');
  for(const [name,value] of Object.entries(values)){
    const path=`/repos/${repository}/actions/variables/${name}`;
    const existing=await api(path,'GET',undefined,{optional:true});
    await api(existing?path:`/repos/${repository}/actions/variables`,existing?'PATCH':'POST',{name,value});
    console.log(`Configured repository variable: ${name}`);
  }
}else if(mode==='enable-pages'){
  const path=`/repos/${repository}/pages`;
  const existing=await api(path,'GET',undefined,{optional:true});
  await api(path,existing?'PUT':'POST',{build_type:'workflow'});
  console.log('GitHub Pages configured to deploy with GitHub Actions.');
}else if(mode==='status'){
  const [pages,runs]=await Promise.all([api(`/repos/${repository}/pages`,'GET',undefined,{optional:true}),api(`/repos/${repository}/actions/runs?branch=main&per_page=5`)]);
  console.log(JSON.stringify({pages:pages?{url:pages.html_url,status:pages.status,build_type:pages.build_type,https_enforced:pages.https_enforced}:null,runs:runs.workflow_runs.map(run=>({id:run.id,sha:run.head_sha,status:run.status,conclusion:run.conclusion,url:run.html_url}))}));
}else if(mode==='jobs'){
  const runId=process.argv[3];
  if(!/^\d+$/.test(runId||''))throw new Error('Provide a numeric run ID.');
  const result=await api(`/repos/${repository}/actions/runs/${runId}/jobs`);
  console.log(JSON.stringify(result.jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps.map(step=>({name:step.name,status:step.status,conclusion:step.conclusion}))}))));
}else throw new Error('Unknown command.');
