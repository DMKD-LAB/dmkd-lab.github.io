import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Executes the production SQL with real PostgreSQL RLS in an isolated engine.
// The local Auth/Storage tables model the service columns used by these policies.
async function install(db) {
    await db.exec(`
      create role anon; create role authenticated;
      grant usage on schema public to anon, authenticated;
      create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean default false, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text, name text);
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated, anon;
      grant all on storage.objects to authenticated, anon;
      grant execute on function storage.foldername(text) to authenticated, anon;
    `);
    await db.exec(await readFile(new URL('../supabase/install.sql', import.meta.url),'utf8'));
}

test('database and storage policies enforce approval, ownership, and publication', async () => {
  const db = new PGlite();
  const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222', pending='33333333-3333-4333-8333-333333333333';
  try {
    await install(db);
    await db.exec(`insert into auth.users(id) values ('${alice}'),('${bob}'),('${pending}'); insert into public.lab_members(user_id,status) values ('${alice}','approved'),('${bob}','approved'),('${pending}','pending');`);
    async function as(role,id,query){await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id||''}',false);`);return db.query(query);}
    const insert=(id, published=false)=>`insert into public.profiles(id,full_name,program,published) values ('${id}','Test Member','ms',${published})`;
    await assert.rejects(()=>as('anon',null,insert(alice)),/permission denied/);
    await assert.rejects(()=>as('authenticated',pending,insert(pending)),/row-level security/);
    await assert.rejects(()=>as('authenticated',pending,`insert into public.lab_members(user_id) values ('${pending}')`),/permission denied/);
    await as('authenticated',alice,insert(alice));
    await as('authenticated',bob,insert(bob,true));
    assert.equal((await as('anon',null,'select * from public.profiles')).rows.length,1);
    assert.equal((await as('authenticated',alice,'select * from public.profiles')).rows.length,2);
    assert.equal((await as('authenticated',bob,`select * from public.profiles where id='${alice}'`)).rows.length,0);
    assert.equal((await as('authenticated',alice,`update public.profiles set full_name='Attack' where id='${bob}' returning id`)).rows.length,0);
    await assert.rejects(()=>as('authenticated',alice,`update public.profiles set id='${pending}' where id='${alice}'`),/row-level security/);
    await assert.rejects(()=>as('authenticated',alice,`update public.profiles set github_url='javascript:alert(1)' where id='${alice}'`),/check constraint/);
    await assert.rejects(()=>as('authenticated',alice,`update public.profiles set program='invalid' where id='${alice}'`),/check constraint/);
    assert.equal((await as('authenticated',alice,`update public.profiles set program='faculty' where id='${alice}' returning program`)).rows[0].program,'faculty');
    await assert.rejects(()=>as('authenticated',alice,`update public.profiles set avatar_path='${bob}/avatars/a.webp' where id='${alice}'`),/check constraint/);
    await as('authenticated',alice,`update public.profiles set published=true where id='${alice}'`);
    assert.equal((await as('anon',null,'select * from public.profiles')).rows.length,2);
    const object=(id,path='gallery/a.webp')=>`insert into storage.objects(bucket_id,name) values ('lab-images','${id}/${path}')`;
    await assert.rejects(()=>as('anon',null,object(alice)),/row-level security/);
    await assert.rejects(()=>as('authenticated',pending,object(pending)),/row-level security/);
    await assert.rejects(()=>as('authenticated',alice,object(bob)),/row-level security/);
    await assert.rejects(()=>as('authenticated',alice,object(alice,'gallery/a.svg')),/row-level security/);
    await as('authenticated',alice,object(alice));
    assert.equal((await as('authenticated',bob,'delete from storage.objects returning id')).rows.length,0);
    await as('authenticated',alice,`insert into public.gallery_photos(owner_id,image_path,caption) values ('${alice}','${alice}/gallery/a.webp','A test photo')`);
    await assert.rejects(()=>as('authenticated',bob,`insert into public.gallery_photos(owner_id,image_path,caption) values ('${alice}','${alice}/gallery/b.webp','Attack')`),/row-level security/);
    assert.equal((await as('authenticated',bob,'delete from public.gallery_photos returning id')).rows.length,0);
    assert.equal((await as('anon',null,'select * from public.gallery_photos')).rows.length,1);
    assert.equal((await as('authenticated',alice,'delete from public.gallery_photos returning id')).rows.length,1);
    assert.equal((await as('authenticated',alice,'delete from storage.objects returning id')).rows.length,1);
    await db.exec(`reset role; delete from public.lab_members where user_id='${alice}';`);
    assert.equal((await as('authenticated',alice,`update public.profiles set full_name='Revoked' where id='${alice}' returning id`)).rows.length,0);
    await assert.rejects(()=>as('authenticated',alice,object(alice)),/row-level security/);
  } finally { await db.close(); }
});

test('verified first owner, approval, role changes, and suspension are enforced by the database', async () => {
  const db=new PGlite();
  const owner='11111111-1111-4111-8111-111111111111', member='22222222-2222-4222-8222-222222222222', unverified='33333333-3333-4333-8333-333333333333';
  try {
    await install(db);
    await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
      ('${owner}','first-admin@example.com',null,'{}'),
      ('${member}','member@example.com',now(),'{"role":"admin","email":"first-admin@example.com"}'),
      ('${unverified}','unverified@example.com',null,'{}');`);
    async function as(id,query,role='authenticated') {
      await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id||''}',false);`);
      return db.query(query);
    }
    const membership=async id=>(await as(id,'select public.current_membership() as result')).rows[0].result;
    const change=(actor,target,role,status)=>as(actor,`select public.set_membership('${target}','${role}','${status}') as result`);
    await assert.rejects(()=>as(null,'select public.current_membership()','anon'),/permission denied/);
    await assert.rejects(()=>as(null,'select public.current_membership()'),/Sign in/);
    await assert.rejects(()=>membership(owner),/Verify your email/);
    assert.deepEqual(await membership(member),{user_id:member,role:'member',status:'pending'});
    await assert.rejects(()=>as(member,'select public.list_memberships()'),/Administrator access/);
    await assert.rejects(()=>change(member,member,'admin','approved'),/Administrator access/);
    await assert.rejects(()=>as(member,'select * from private.lab_bootstrap'),/permission denied/);
    await assert.rejects(()=>as(member,`update public.lab_members set role='admin' where user_id='${member}'`),/permission denied/);
    await db.exec(`reset role; update auth.users set email_confirmed_at=now() where id='${owner}';`);
    assert.deepEqual(await membership(owner),{user_id:owner,role:'admin',status:'approved'});
    await membership(owner); // repeat logins must not produce another bootstrap.
    await assert.rejects(()=>change(owner,owner,'member','approved'),/at least one approved administrator/);
    await assert.rejects(()=>change(owner,owner,'admin','suspended'),/at least one approved administrator/);
    await assert.rejects(()=>change(owner,unverified,'member','approved'),/verify its email/);
    await assert.rejects(()=>change(owner,member,'owner','approved'),/valid role/);
    await change(owner,member,'member','approved');
    assert.equal((await membership(member)).status,'approved');
    await as(member,`insert into public.profiles(id,full_name,program,published) values('${member}','Test Member','ms',true)`);
    await change(owner,member,'admin','approved');
    assert.equal((await membership(member)).role,'admin');
    const result=(await as(member,"select public.list_memberships('UNVERIFIED',1) as result")).rows[0].result;
    assert.equal(result.total,1); assert.equal(result.members[0].email_verified,false);
    await change(member,owner,'member','approved');
    assert.equal((await membership(owner)).role,'member'); // original owner cannot re-bootstrap after demotion.
    await assert.rejects(()=>change(owner,owner,'admin','approved'),/Administrator access/);
    await change(member,owner,'admin','approved');
    await change(owner,member,'member','suspended');
    assert.equal((await membership(member)).status,'suspended');
    assert.equal((await as(null,'select * from public.profiles','anon')).rows.length,0);
    assert.equal((await as(member,`update public.profiles set published=true where id='${member}' returning id`)).rows.length,0);
    await assert.rejects(()=>as(member,`insert into storage.objects(bucket_id,name) values('lab-images','${member}/gallery/a.webp')`),/row-level security/);
    await assert.rejects(()=>as(member,'select public.list_memberships()'),/Administrator access/);
    await assert.rejects(()=>as(owner,'select * from private.membership_audit'),/permission denied/);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int as n from private.membership_audit where action='bootstrap'")).rows[0].n,1);
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) select gen_random_uuid(),'account'||n||'@example.com',now() from generate_series(1,23) n;`);
    const paged=(await as(owner,"select public.list_memberships('',2) as result")).rows[0].result;
    assert.equal(paged.total,26);assert.equal(paged.members.length,6);
  } finally { await db.close(); }
});
