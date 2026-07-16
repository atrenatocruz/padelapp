import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// Service-role client: bypasses RLS because the bot acts on behalf of
// whichever player matches a WhatsApp phone number, not as an
// authenticated auth.uid(). Never expose this key to the browser bundle.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
