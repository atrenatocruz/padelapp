import { supabase } from './supabase.js'

/** The `settings` table is a single row (see supabase/schema.sql:72-78). */
export async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*').limit(1).single()
  if (error) throw new Error(`Failed to load settings: ${error.message}`)
  return data
}
