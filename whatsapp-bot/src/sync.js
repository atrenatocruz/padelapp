import { getSettings } from './settings.js'
import { supabase } from './supabase.js'
import { loadGame, getOpenMixes, buildCombinedRosterMessage } from './roster.js'
import { HELP_FOOTER } from './messages.js'

const DEBOUNCE_MS = 4000
const RECONCILE_INTERVAL_MS = 60 * 1000

// A single debounce/dedupe pair — the group only ever gets ONE roster
// message covering every open mix at once, not one message per mix.
let debounceTimer = null
let lastPostedHash = null

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

async function postCombinedRoster(sendText) {
  const settings = await getSettings()
  if (!settings.whatsapp_group_jid) return

  const openMixes = await getOpenMixes()
  const mixStates = await Promise.all(openMixes.map((mix) => loadGame(mix.id)))
  const text = buildCombinedRosterMessage(mixStates)
  if (!text) return // nothing open right now — nothing to broadcast

  const nextHash = hash(text)
  if (nextHash === lastPostedHash) return

  await sendText(settings.whatsapp_group_jid, text)
  lastPostedHash = nextHash
}

function scheduleRepost(sendText) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    postCombinedRoster(sendText).catch((err) => console.error('Failed to repost combined roster:', err))
  }, DEBOUNCE_MS)
}

/** Wires Supabase Realtime so any game/participant change — from the app OR from the bot's own WhatsApp-driven writes, for ANY currently open mix — results in a fresh combined roster repost covering every open mix. */
export function startSync({ sendText }) {
  supabase
    .channel('whatsapp-bot-games')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, async (payload) => {
      if (payload.new.status !== 'open') return
      scheduleRepost(sendText)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, async (payload) => {
      const settings = await getSettings()
      if (!settings.whatsapp_group_jid) return

      const wasCancelled = payload.old.status === 'cancelled'
      if (payload.new.status === 'cancelled' && !wasCancelled) {
        await sendText(
          settings.whatsapp_group_jid,
          `🤖 O mix "${payload.new.title}" foi cancelado ❌${HELP_FOOTER}`
        )
      }
      // Refresh the combined view either way (drops the cancelled mix,
      // or reflects whatever else changed).
      scheduleRepost(sendText)
    })
    .subscribe()

  supabase
    .channel('whatsapp-bot-participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
      // Always recomputed fresh from the DB at post time, and the hash
      // check above skips a no-op send — no need to pre-filter which
      // mix this row belongs to.
      scheduleRepost(sendText)
    })
    .subscribe()

  // Safety net: catches any change missed during a transient Realtime
  // disconnect, without spamming (only reposts if the combined roster
  // actually differs from what was last sent).
  setInterval(() => {
    postCombinedRoster(sendText).catch((err) => console.error('Reconciliation tick failed:', err))
  }, RECONCILE_INTERVAL_MS)
}
