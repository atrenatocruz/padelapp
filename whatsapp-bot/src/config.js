import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  // Multi-tenant: each bot deployment serves exactly one club/organization.
  organizationId: required('ORGANIZATION_ID'),
  authDir: process.env.AUTH_DIR || './baileys-auth',
  port: Number(process.env.PORT) || 8080,
  pairingPhone: process.env.PAIRING_PHONE || null,
  appUrl: process.env.APP_URL || 'https://padelapp-pi.vercel.app',
}
