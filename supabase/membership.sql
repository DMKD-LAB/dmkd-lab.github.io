-- Apply AFTER setup.sql. Adds verified first-administrator bootstrap and member management.
-- Public RPCs are security invokers; privileged implementations live outside exposed schemas.
begin;

alter table public.lab_members
  add column role text not null default 'member' check (role in ('member','admin')),
  add column status text not null default 'approved' check (status in ('pending','approved','suspended')),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
alter table public.lab_members alter column approved_at drop not null;
alter table public.lab_members alter column approved_at drop default;
-- Preserve existing approvals; every new request explicitly starts pending.
alter table public.lab_members alter column status set default 'pending';
create index lab_members_active_admin_idx on public.lab_members(user_id) where role='admin' and status='approved';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.lab_bootstrap (
  singleton boolean primary key default true check (singleton),
  owner_email text not null,
  -- Retain the consumed UUID even if an Auth account is deleted: bootstrap is one-time.
  claimed_by uuid,
  claimed_at timestamptz
);
insert into private.lab_bootstrap(singleton,owner_email) values(true,'first-admin@example.com');
create table private.membership_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_id uuid not null,
  action text not null,
  previous_state jsonb,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.lab_bootstrap enable row level security;
alter table private.membership_audit enable row level security;
revoke all on private.lab_bootstrap, private.membership_audit from public, anon, authenticated;

create function private.current_membership()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid();
  account auth.users%rowtype;
  bootstrap private.lab_bootstrap%rowtype;
  membership public.lab_members%rowtype;
begin
  if caller is null then raise exception 'Sign in to access your membership.' using errcode='42501'; end if;
  select * into account from auth.users where id=caller;
  if not found or account.email_confirmed_at is null or coalesce(account.is_anonymous,false) then
    raise exception 'Verify your email before requesting lab membership.' using errcode='42501';
  end if;
  -- Serializes first-owner claims with role changes, including last-admin protection.
  select * into bootstrap from private.lab_bootstrap where singleton for update;
  if bootstrap.claimed_by is null and lower(account.email)=lower(bootstrap.owner_email) then
    insert into public.lab_members(user_id,role,status,approved_at)
    values(caller,'admin','approved',now())
    on conflict(user_id) do update set role='admin',status='approved',approved_at=now(),updated_at=now();
    update private.lab_bootstrap set claimed_by=caller,claimed_at=now() where singleton;
    insert into private.membership_audit(actor_id,target_id,action,new_state)
    values(caller,caller,'bootstrap',jsonb_build_object('role','admin','status','approved'));
  else
    insert into public.lab_members(user_id,role,status) values(caller,'member','pending')
    on conflict(user_id) do nothing;
  end if;
  select * into membership from public.lab_members where user_id=caller;
  return jsonb_build_object('user_id',membership.user_id,'role',membership.role,'status',membership.status);
end;
$$;

create function private.list_memberships(p_search text default '',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid();
  search text := left(coalesce(p_search,''),100);
  page_number integer := greatest(1,least(coalesce(p_page,1),100000));
  result jsonb;
begin
  if caller is null or not exists (
    select 1 from public.lab_members m join auth.users u on u.id=m.user_id
    where m.user_id=caller and m.role='admin' and m.status='approved' and u.email_confirmed_at is not null
  ) then raise exception 'Administrator access required.' using errcode='42501'; end if;
  with accounts as (
    select u.id as user_id,u.email,u.email_confirmed_at is not null as email_verified,
      coalesce(m.role,'member') as role,coalesce(m.status,'pending') as status,
      p.full_name,u.created_at,m.approved_at,m.updated_at
    from auth.users u left join public.lab_members m on m.user_id=u.id
    left join public.profiles p on p.id=u.id
    where not coalesce(u.is_anonymous,false)
      and (search='' or position(lower(search) in lower(coalesce(u.email,'')))>0
        or position(lower(search) in lower(coalesce(p.full_name,'')))>0)
  ), page as (
    select * from accounts order by (status='pending') desc,created_at desc,user_id
    limit 20 offset ((page_number-1)*20)
  ) select jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
    'total',(select count(*) from accounts)) into result;
  return result;
end;
$$;

create function private.set_membership(p_user_id uuid,p_role text,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid := auth.uid();
  target auth.users%rowtype;
  previous public.lab_members%rowtype;
begin
  if caller is null then raise exception 'Administrator access required.' using errcode='42501'; end if;
  perform 1 from private.lab_bootstrap where singleton for update;
  -- Check current database permissions after locking; a stale token cannot restore a revoked role.
  if not exists (
    select 1 from public.lab_members m join auth.users u on u.id=m.user_id
    where m.user_id=caller and m.role='admin' and m.status='approved' and u.email_confirmed_at is not null
  ) then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_role is null or p_role not in ('member','admin') or p_status is null or p_status not in ('pending','approved','suspended') then
    raise exception 'Choose a valid role and access status.' using errcode='22023';
  end if;
  select * into target from auth.users where id=p_user_id;
  if not found or coalesce(target.is_anonymous,false) then raise exception 'This account no longer exists.' using errcode='22023'; end if;
  if p_status='approved' and target.email_confirmed_at is null then
    raise exception 'This account must verify its email before approval.' using errcode='22023';
  end if;
  select * into previous from public.lab_members where user_id=p_user_id;
  if previous.role='admin' and previous.status='approved' and (p_role<>'admin' or p_status<>'approved') and
    (select count(*) from public.lab_members where role='admin' and status='approved')<=1 then
    raise exception 'Keep at least one approved administrator. Promote another member first.' using errcode='22023';
  end if;
  insert into public.lab_members(user_id,role,status,approved_at)
  values(p_user_id,p_role,p_status,case when p_status='approved' then now() end)
  on conflict(user_id) do update set role=excluded.role,status=excluded.status,
    approved_at=case when excluded.status='approved' then coalesce(lab_members.approved_at,now()) else null end,updated_at=now();
  if p_status<>'approved' then update public.profiles set published=false where id=p_user_id; end if;
  insert into private.membership_audit(actor_id,target_id,action,previous_state,new_state)
  values(caller,p_user_id,'set_membership',to_jsonb(previous),jsonb_build_object('role',p_role,'status',p_status));
  return jsonb_build_object('user_id',p_user_id,'role',p_role,'status',p_status);
end;
$$;

revoke all on function private.current_membership(),private.list_memberships(text,integer),private.set_membership(uuid,text,text) from public,anon,authenticated;
grant execute on function private.current_membership(),private.list_memberships(text,integer),private.set_membership(uuid,text,text) to authenticated;
create function public.current_membership() returns jsonb language sql security invoker set search_path=''
as $$ select private.current_membership(); $$;
create function public.list_memberships(p_search text default '',p_page integer default 1) returns jsonb language sql security invoker set search_path=''
as $$ select private.list_memberships(p_search,p_page); $$;
create function public.set_membership(p_user_id uuid,p_role text,p_status text) returns jsonb language sql security invoker set search_path=''
as $$ select private.set_membership(p_user_id,p_role,p_status); $$;
revoke all on function public.current_membership(),public.list_memberships(text,integer),public.set_membership(uuid,text,text) from public,anon,authenticated;
grant execute on function public.current_membership(),public.list_memberships(text,integer),public.set_membership(uuid,text,text) to authenticated;

-- Existing policies must now require approved status, not mere row existence.
drop policy "Approved members create their own profile" on public.profiles;
create policy "Approved members create their own profile" on public.profiles for insert to authenticated
with check (id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members edit their own profile" on public.profiles;
create policy "Approved members edit their own profile" on public.profiles for update to authenticated
using (id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'))
with check (id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members delete their own profile" on public.profiles;
create policy "Approved members delete their own profile" on public.profiles for delete to authenticated
using (id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members publish their own photos" on public.gallery_photos;
create policy "Approved members publish their own photos" on public.gallery_photos for insert to authenticated
with check (owner_id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members delete their own photos" on public.gallery_photos;
create policy "Approved members delete their own photos" on public.gallery_photos for delete to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Members read their own storage objects" on storage.objects;
create policy "Members read their own storage objects" on storage.objects for select to authenticated
using (bucket_id='lab-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members upload to their own folder" on storage.objects;
create policy "Approved members upload to their own folder" on storage.objects for insert to authenticated
with check (bucket_id='lab-images' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[a-f0-9-]+/(avatars|gallery)/[a-f0-9-]+\.webp$'
  and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));
drop policy "Approved members remove their own images" on storage.objects;
create policy "Approved members remove their own images" on storage.objects for delete to authenticated
using (bucket_id='lab-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.lab_members where user_id=(select auth.uid()) and status='approved'));

commit;
