import { supabase } from './supabase.js'
import { config } from './config.js'

/**
 * Resolves a WhatsApp phone-number JID (e.g. "351916376443@s.whatsapp.net")
 * to a profile that's actually a member of THIS bot's organization.
 *
 * Hashing is centralized in the `hash-phone` Edge Function (not
 * reimplemented here) so every bot deployment and the web app compute the
 * exact same hash for the same person — see
 * supabase/functions/hash-phone/index.ts. The bot authenticates to it with
 * its existing service-role key (via the shared `supabase` client), no
 * separate secret needed here.
 *
 * No caching: matching now requires a network round-trip regardless, and
 * this bot's message volume is far too low to need it.
 */
export async function resolveProfileByPhoneJid(phoneJid) {
  if (!phoneJid) return null

  const digits = phoneJid.split('@')[0]
  const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-phone', {
    body: { phone: digits },
  })
  if (hashError) {
    console.error('Failed to hash phone number:', hashError)
    return null
  }
  const hash = hashData?.hash
  if (!hash) return null

  // Matching on phone_hash alone isn't enough — it identifies the person,
  // but they also need to actually belong to THIS org (a real member of a
  // different club shouldn't resolve here).
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, profile:profiles!inner(id, name, phone_hash)')
    .eq('organization_id', config.organizationId)
    .eq('profile.phone_hash', hash)
    .maybeSingle()

  if (error) {
    console.error('Failed to look up membership by phone hash:', error)
    return null
  }
  if (!data) return null

  return { id: data.user_id, name: data.profile.name }
}
