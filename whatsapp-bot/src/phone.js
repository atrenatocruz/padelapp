import { supabase } from './supabase.js'

const CACHE_TTL_MS = 5 * 60 * 1000

let cache = { at: 0, byLast9: new Map() }

function normalize(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  return digits
}

function last9(digits) {
  return digits.slice(-9)
}

async function refreshCache() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, phone')
    .eq('is_guest', false)
    .not('phone', 'is', null)

  if (error) {
    throw new Error(`Failed to load profiles for phone matching: ${error.message}`)
  }

  const byLast9 = new Map()
  for (const profile of data) {
    const key = last9(normalize(profile.phone))
    if (!key || key.length < 9) continue
    if (byLast9.has(key)) {
      // Ambiguous — two profiles share the same national number. Mark as
      // unresolvable rather than guessing which one a sender means.
      byLast9.set(key, 'AMBIGUOUS')
    } else {
      byLast9.set(key, profile)
    }
  }

  cache = { at: Date.now(), byLast9 }
}

async function ensureFreshCache() {
  if (Date.now() - cache.at > CACHE_TTL_MS) {
    await refreshCache()
  }
}

/**
 * Resolves a WhatsApp phone-number JID (e.g. "351916376443@s.whatsapp.net")
 * to a profiles row, matching on the last 9 digits of the phone number so
 * country-code/formatting differences don't block a match. Returns null if
 * unmatched or ambiguous (never guesses).
 */
export async function resolveProfileByPhoneJid(phoneJid) {
  if (!phoneJid) {
    console.warn(
      'Phone match failed: WhatsApp gave no phone-number JID for this sender (likely a @lid privacy identity with no phone mapping).'
    )
    return null
  }
  await ensureFreshCache()

  const digits = normalize(phoneJid.split('@')[0])
  const key = last9(digits)
  if (!key || key.length < 9) {
    console.warn(`Phone match failed: could not extract 9 digits from "${phoneJid}".`)
    return null
  }

  const match = cache.byLast9.get(key)
  if (!match) {
    console.warn(
      `Phone match failed: no profile with last-9-digits "${key}" (from ${phoneJid}). Known keys: ${[...cache.byLast9.keys()].join(', ') || '(none cached)'}`
    )
    return null
  }
  if (match === 'AMBIGUOUS') {
    console.warn(`Phone match failed: last-9-digits "${key}" matches more than one profile.`)
    return null
  }
  return match
}

export function invalidatePhoneCache() {
  cache = { at: 0, byLast9: new Map() }
}
