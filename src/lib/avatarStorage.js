import { supabase } from './supabase'
import { compressImage } from './compressImage'

const BUCKET = 'avatars'

function avatarPath(userId) {
  return `${userId}/avatar.jpg`
}

/**
 * Compresses, uploads (overwriting any previous photo at the same fixed
 * path), and returns a cache-busted public URL to save onto
 * profiles.avatar_url. Without the ?v= query param, a browser could keep
 * showing a stale cached image after someone changes their photo, since
 * the underlying path never changes.
 */
export async function uploadAvatar(userId, file) {
  const blob = await compressImage(file)
  const path = avatarPath(userId)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function removeAvatar(userId) {
  const { error } = await supabase.storage.from(BUCKET).remove([avatarPath(userId)])
  if (error) throw error
}
