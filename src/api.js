import { createClient } from '@supabase/supabase-js';
import { prepareImage } from './validation.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
const requireClient = () => {
  if (!supabase) throw new Error('Member access is not available yet. Please contact the lab administrator.');
  return supabase;
};
const check = ({ data, error }) => { if (error) throw error; return data; };
export const assetUrl = (path) => path && supabase ? supabase.storage.from('lab-images').getPublicUrl(path).data.publicUrl : '';

export async function loadPublicData() {
  if (!supabase) return { profiles: [], photos: [] };
  const [profiles, photos] = await Promise.all([
    supabase.from('profiles').select('*').eq('published', true).order('full_name'),
    supabase.from('gallery_photos').select('*').order('created_at', { ascending: false }),
  ]);
  return { profiles: check(profiles), photos: check(photos) };
}

export async function loadAccount(userId) {
  const client = requireClient();
  const [member, profile] = await Promise.all([
    client.rpc('current_membership'),
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
  ]);
  const membership=check(member);
  return { approved: membership?.status==='approved', role: membership?.role || 'member', status: membership?.status || 'pending', profile: check(profile) };
}

export async function listMemberships(search='', page=1) {
  return check(await requireClient().rpc('list_memberships',{p_search:search,p_page:page}));
}

export async function setMembership(userId, role, status) {
  return check(await requireClient().rpc('set_membership',{p_user_id:userId,p_role:role,p_status:status}));
}

async function uploadImage(userId, folder, file) {
  const blob = await prepareImage(file, folder === 'avatars' ? 1000 : 1800);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.webp`;
  check(await requireClient().storage.from('lab-images').upload(path, blob, { contentType: 'image/webp', cacheControl: '3600', upsert: false }));
  return path;
}

async function removeImage(path) {
  if (!path) return;
  const { error } = await requireClient().storage.from('lab-images').remove([path]);
  if (error) console.warn('An unused image could not be removed. The administrator can clean up storage.');
}

export async function saveProfile(userId, values, file, oldPath) {
  let newPath;
  try {
    if (file) newPath = await uploadImage(userId, 'avatars', file);
    const avatarPath = newPath || (values.removePhoto ? null : oldPath) || null;
    const { removePhoto: _removePhoto, ...fields } = values;
    const profile = check(await requireClient().from('profiles').upsert({ ...fields, id: userId, avatar_path: avatarPath }, { onConflict: 'id' }).select().single());
    if (oldPath && oldPath !== avatarPath) await removeImage(oldPath);
    return profile;
  } catch (error) {
    if (newPath) await removeImage(newPath);
    throw error;
  }
}

export async function addGalleryPhoto(userId, file, caption) {
  const path = await uploadImage(userId, 'gallery', file);
  try {
    return check(await requireClient().from('gallery_photos').insert({ owner_id: userId, image_path: path, caption }).select().single());
  } catch (error) { await removeImage(path); throw error; }
}

export async function deleteGalleryPhoto(photo) {
  const data = check(await requireClient().from('gallery_photos').delete().eq('id', photo.id).select('id'));
  if (!data.length) throw new Error('This photo could not be removed. Check your member access and try again.');
  await removeImage(photo.image_path);
}
