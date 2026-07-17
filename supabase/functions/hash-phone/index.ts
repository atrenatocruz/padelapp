// Supabase Edge Function: hashes a phone number with a secret that never
// touches Postgres/Vault — this is the ONLY place the secret lives.
//
// Centralized on purpose: both the web app (signup, profile) and every
// WhatsApp bot deployment call this same function instead of each
// re-implementing HMAC locally, so there's exactly one algorithm and no
// risk of the same person hashing differently in different places (which
// would silently break cross-club identity matching for anyone in 2+ orgs).
//
// Access control: Supabase's default JWT verification accepts ANY
// validly-signed project JWT, including the public anon key already in
// the browser bundle. Left unchecked, that turns this into an open
// "hash any number for me" oracle — phone numbers are low-entropy, so an
// attacker with a DB dump could brute-force every stored hash back to a
// real number in seconds. We explicitly reject `role: "anon"` and only
// accept `authenticated` (real logged-in users) or `service_role` (the
// bot, which already holds the service-role key — no new secret needed).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return atob(base64)
}

function getJwtRole(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

// Same scheme the app used for plaintext matching before hashing existed:
// strip non-digits, drop a leading "00", keep the last 9 digits (PT mobile
// number length) — so +351/00351/no-prefix variants all hash identically.
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  return digits.slice(-9)
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const role = getJwtRole(req.headers.get('Authorization'))
  if (role !== 'authenticated' && role !== 'service_role') {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { phone?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const normalized = normalizePhone(body.phone || '')
  if (normalized.length < 9) {
    return jsonResponse({ error: 'Invalid phone number' }, 400)
  }

  const secret = Deno.env.get('PHONE_HASH_SECRET')
  if (!secret) {
    console.error('PHONE_HASH_SECRET is not set')
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  const hash = await hmacSha256Hex(normalized, secret)
  return jsonResponse({ hash })
})
