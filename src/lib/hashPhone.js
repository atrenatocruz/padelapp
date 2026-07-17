import { supabase } from './supabase'

/**
 * Hashes a phone number via the `hash-phone` Edge Function — the raw
 * number is sent over the wire to that function only, never stored or
 * logged anywhere in Supabase. Requires an active session (the function
 * rejects the anon key on purpose — see supabase/functions/hash-phone).
 */
export async function hashPhone(phone) {
  const { data, error } = await supabase.functions.invoke('hash-phone', {
    body: { phone },
  })
  if (error) throw error
  return data.hash
}
