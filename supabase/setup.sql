-- Run once in a NEW Supabase project's SQL Editor. This file is transactional.
-- Existing projects: review names and policies before applying.
begin;

create table public.lab_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);
alter table public.lab_members enable row level security;
revoke all on public.lab_members from anon, authenticated;
grant select on public.lab_members to authenticated;
create policy "Members can check their own approval" on public.lab_members
  for select to authenticated using (user_id = (select auth.uid()));
-- There are deliberately no client INSERT/UPDATE/DELETE grants or policies.
-- Approval is managed by the lab administrator in the Supabase dashboard.

create function public.valid_interests(items text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(cardinality(items) <= 8 and not exists (
    select 1 from unnest(items) as item
    where item is null or char_length(btrim(item)) not between 1 and 40
  ), false);
$$;
revoke all on function public.valid_interests(text[]) from public;
grant execute on function public.valid_interests(text[]) to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  program text not null check (program in ('faculty', 'ms', 'bsms', 'undergraduate')),
  interests text[] not null default '{}' check (public.valid_interests(interests)),
  avatar_path text check (avatar_path is null or (avatar_path like id::text || '/avatars/%' and avatar_path ~ '/[a-f0-9-]+\.webp$')),
  linkedin_url text not null default '' check (char_length(linkedin_url) <= 500 and (linkedin_url = '' or linkedin_url ~ '^https://(www\.)?linkedin\.com(/[^[:space:]]*)?$')),
  scholar_url text not null default '' check (char_length(scholar_url) <= 500 and (scholar_url = '' or scholar_url ~ '^https://scholar\.google\.com(/[^[:space:]]*)?$')),
  github_url text not null default '' check (char_length(github_url) <= 500 and (github_url = '' or github_url ~ '^https://(www\.)?github\.com(/[^[:space:]]*)?$')),
  public_email text not null default '' check (char_length(public_email) <= 254 and (public_email = '' or public_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;
create policy "Visitors can read published profiles" on public.profiles
  for select to anon, authenticated using (published);
create policy "Users can read their own draft" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Approved members create their own profile" on public.profiles
  for insert to authenticated with check (
    id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create policy "Approved members edit their own profile" on public.profiles
  for update to authenticated using (
    id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  ) with check (
    id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create policy "Approved members delete their own profile" on public.profiles
  for delete to authenticated using (
    id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create index profiles_published_name_idx on public.profiles (full_name) where published;

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null unique check (image_path like owner_id::text || '/gallery/%' and image_path ~ '/[a-f0-9-]+\.webp$'),
  caption text not null check (char_length(btrim(caption)) between 1 and 240),
  created_at timestamptz not null default now()
);
alter table public.gallery_photos enable row level security;
revoke all on public.gallery_photos from anon, authenticated;
grant select on public.gallery_photos to anon, authenticated;
grant insert, delete on public.gallery_photos to authenticated;
create policy "Visitors read gallery photos" on public.gallery_photos
  for select to anon, authenticated using (true);
create policy "Approved members publish their own photos" on public.gallery_photos
  for insert to authenticated with check (
    owner_id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create policy "Approved members delete their own photos" on public.gallery_photos
  for delete to authenticated using (
    owner_id = (select auth.uid()) and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create index gallery_photos_owner_idx on public.gallery_photos (owner_id);
create index gallery_photos_created_idx on public.gallery_photos (created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-images', 'lab-images', true, 5242880, array['image/webp']);
-- Only browser-decoded, re-encoded WebP images are uploaded by the application.
-- The bucket is public: photos are website assets, not confidential files.
create policy "Members read their own storage objects" on storage.objects
  for select to authenticated using (
    bucket_id = 'lab-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create policy "Approved members upload to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'lab-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[a-f0-9-]+/(avatars|gallery)/[a-f0-9-]+\.webp$'
    and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
create policy "Approved members remove their own images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'lab-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.lab_members where user_id = (select auth.uid()))
  );
-- No UPDATE policy: uploads use unique filenames, never overwrite another object.
commit;
