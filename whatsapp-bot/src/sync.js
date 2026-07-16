import { supabase } from './supabase.js'
import { getSettings } from './settings.js'
import { loadGame, buildRosterMessage, getOpenMixes } from './roster.js'
import { HELP_FOOTER } from './messages.js'

const DEBOUNCE_MS = 4000
const RECONCILE_INTERVAL_MS = 60 * 1000

// Keyed by game_id — several mixes can be open at once, each with its own
// independent debounce/dedupe state, so one mix's repost never clobbers
// another's.
const debounceTimers = new Map()
const lastPostedHashes = new Map()

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

async function postRoster(sendText, gameId) {
  const settings = await getSettings()
  if (!settings.whatsapp_group_jid) return

  const state = await loadGame(gameId)
  const text = buildRosterMessage(state)
  const nextHash = hash(text)
  if (nextHash === lastPostedHashes.get(gameId)) return

  await sendText(settings.whatsapp_group_jid, text)
  lastPostedHashes.set(gameId, nextHash)
}

function scheduleRepost(sendText, gameId) {
  const existingTimer = debounceTimers.get(gameId)
  if (existingTimer) clearTimeout(existingTimer)

  const timer = setTimeout(() => {
    debounceTimers.delete(gameId)
    postRoster(sendText, gameId).catch((err) => console.error(`Failed to repost roster for mix ${gameId}:`, err))
  }, DEBOUNCE_MS)
  debounceTimers.set(gameId, timer)
}

async function isOpenMix(gameId) {
  const { data, error } = await supabase
    .from('games')
    .select('status, date')
    .eq('id', gameId)
    .single()
  if (error || !data) return false
  return (data.status === 'open' || data.status === 'closed') && new Date(data.date).getTime() > Date.now()
}

/** Wires Supabase Realtime so any participant/game change — from the app OR from the bot's own WhatsApp-driven writes, for ANY currently open mix — results in a fresh roster repost for that specific mix. */
export function startSync({ sendText }) {
  supabase
    .channel('whatsapp-bot-games')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, async (payload) => {
      const game = payload.new
      if (game.status !== 'open') return
      lastPostedHashes.delete(game.id)
      scheduleRepost(sendText, game.id)
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
        return
      }
      scheduleRepost(sendText, payload.new.id)
    })
    .subscribe()

  supabase
    .channel('whatsapp-bot-participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, async (payload) => {
      const row = payload.new?.game_id ? payload.new : payload.old
      if (!row?.game_id) return
      if (!(await isOpenMix(row.game_id))) return
      scheduleRepost(sendText, row.game_id)
    })
    .subscribe()

  // Safety net: catches any change missed during a transient Realtime
  // disconnect, without spamming (only reposts if a mix's roster actually
  // differs from what was last sent). Reconciles every currently open mix
  // independently so one failing lookup doesn't block the rest.
  setInterval(async () => {
    let openMixes
    try {
      openMixes = await getOpenMixes()
    } catch (err) {
      console.error('Reconciliation tick failed to load open mixes:', err)
      return
    }
    for (const mix of openMixes) {
      try {
        await postRoster(sendText, mix.id)
      } catch (err) {
        console.error(`Reconciliation failed for mix ${mix.id}:`, err)
      }
    }
  }, RECONCILE_INTERVAL_MS)
}
