// Creates a synthetic "test" player — a real Supabase Auth user (never
// logged into), a minimal profile, and an org membership tagged
// is_guest=true/is_test=true — so an admin can quickly fill a mix to test
// round generation, the round timer, scoring, etc. without real signups.
//
// This has to run server-side: profiles.id is a hard foreign key to
// auth.users, so a fake profile needs a real Auth user behind it, which
// only the Admin API (service-role key) can create.
//
// Access control: rejects the anon key outright, and separately verifies
// the caller is actually an admin of the target organization — required
// here (not left to RLS) because this function uses the service-role key,
// which bypasses RLS entirely.

import { createClient } from 'jsr:@supabase/supabase-js@2'

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

function decodeJwt(authHeader: string | null): { role: string | null; sub: string | null } {
  if (!authHeader?.startsWith('Bearer ')) return { role: null, sub: null }
  const token = authHeader.slice('Bearer '.length)
  const parts = token.split('.')
  if (parts.length !== 3) return { role: null, sub: null }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return {
      role: typeof payload.role === 'string' ? payload.role : null,
      sub: typeof payload.sub === 'string' ? payload.sub : null,
    }
  } catch {
    return { role: null, sub: null }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const { role, sub: callerId } = decodeJwt(req.headers.get('Authorization'))
  if (role !== 'authenticated' || !callerId) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const organizationId = body.organization_id
  if (!organizationId) {
    return jsonResponse({ error: 'Missing organization_id' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: callerMembership, error: callerError } = await admin
    .from('memberships')
    .select('is_admin')
    .eq('organization_id', organizationId)
    .eq('user_id', callerId)
    .maybeSingle()
  if (callerError) {
    console.error('Failed to check caller membership:', callerError)
    return jsonResponse({ error: 'Server error' }, 500)
  }
  if (!callerMembership?.is_admin) {
    return jsonResponse({ error: 'Only org admins can add test users' }, 403)
  }

  const { count, error: countError } = await admin
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('is_test', true)
  if (countError) {
    console.error('Failed to count existing test users:', countError)
    return jsonResponse({ error: 'Server error' }, 500)
  }
  const name = `Teste ${(count || 0) + 1}`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `test-${crypto.randomUUID()}@padelapp.test`,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { name },
  })
  if (createError || !created?.user) {
    console.error('Failed to create test auth user:', createError)
    return jsonResponse({ error: 'Failed to create test user' }, 500)
  }

  const { error: membershipError } = await admin.from('memberships').insert({
    user_id: created.user.id,
    organization_id: organizationId,
    is_admin: false,
    is_guest: true,
    is_test: true,
    level: 'iniciante',
  })
  if (membershipError) {
    console.error('Failed to create test membership:', membershipError)
    return jsonResponse({ error: 'Failed to create test user' }, 500)
  }

  return jsonResponse({ user_id: created.user.id, name })
})
