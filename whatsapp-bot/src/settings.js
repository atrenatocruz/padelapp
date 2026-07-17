import { supabase } from './supabase.js'
import { config } from './config.js'

/**
 * This bot's own organization row (multi-tenant: `settings` was replaced
 * by `organizations`, one row per club — see supabase/schema.sql). Kept
 * the name `getSettings` since every caller already expects
 * `whatsapp_group_jid` etc. off the returned object.
 */
export async function getSettings() {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', config.organizationId)
    .single()
  if (error) throw new Error(`Failed to load organization ${config.organizationId}: ${error.message}`)
  return data
}
