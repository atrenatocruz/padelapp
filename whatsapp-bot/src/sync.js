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
// Sticky across debounce coalescing: if ANY change folded into the next
// repost was a create/edit, the eventual send tags @all — a rapid
// create+edit within the debounce window doesn't lose the tag.
let pendingTagAll = false
// Sticky across debounce coalescing, same reasoning as pendingTagAll: names
// of anyone auto-promoted from suplente to confirmed since the last repost.
let pendingPromotedNames = []

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return h
}

async function postCombinedRoster(sendText, getGroupMentions, { tagAll = false, promotedNames = [] } = {}) {
  const settings = await getSettings()
  if (!settings.whatsapp_group_jid) return

  const openMixes = await getOpenMixes()
  const mixStates = await Promise.all(openMixes.map((mix) => loadGame(mix.id)))
  const text = buildCombinedRosterMessage(mixStates, { promotedNames })
  if (!text) return // nothing open right now — nothing to broadcast

  const nextHash = hash(text)
  if (nextHash === lastPostedHash) return

  if (tagAll) {
    const mentions = await getGroupMentions(settings.whatsapp_group_jid)
    await sendText(settings.whatsapp_group_jid, `📢 @all\n\n${text}`, { mentions })
  } else {
    await sendText(settings.whatsapp_group_jid, text)
  }
  lastPostedHash = nextHash
}

function scheduleRepost(sendText, getGroupMentions, { tagAll = false, promotedNames = [] } = {}) {
  pendingTagAll = pendingTagAll || tagAll
  pendingPromotedNames = pendingPromotedNames.concat(promotedNames)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const shouldTagAll = pendingTagAll
    const namesToAnnounce = pendingPromotedNames
    pendingTagAll = false
    pendingPromotedNames = []
    postCombinedRoster(sendText, getGroupMentions, { tagAll: shouldTagAll, promotedNames: namesToAnnounce }).catch((err) =>
      console.error('Failed to repost combined roster:', err)
    )
  }, DEBOUNCE_MS)
}

/** Wires Supabase Realtime so any game/participant change — from the app OR from the bot's own WhatsApp-driven writes, for ANY currently open mix — results in a fresh combined roster repost covering every open mix. */
export function startSync({ sendText, getGroupMentions }) {
  supabase
    .channel('whatsapp-bot-games')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, async (payload) => {
      if (payload.new.status !== 'open') return
      // A brand-new mix — tag everyone so the group notices.
      scheduleRepost(sendText, getGroupMentions, { tagAll: true })
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, async (payload) => {
      const settings = await getSettings()
      if (!settings.whatsapp_group_jid) return

      const wasCancelled = payload.old.status === 'cancelled'
      const justCancelled = payload.new.status === 'cancelled' && !wasCancelled
      if (justCancelled) {
        const mentions = await getGroupMentions(settings.whatsapp_group_jid)
        await sendText(
          settings.whatsapp_group_jid,
          `📢 @all\n\n🤖 O mix "${payload.new.title}" foi cancelado ❌${HELP_FOOTER}`,
          { mentions }
        )
      }
      // Refresh the combined view either way (drops the cancelled mix,
      // or reflects whatever else changed). The cancellation notice above
      // already tagged everyone, so don't double-tag on its follow-up
      // refresh — any other edit still tags.
      scheduleRepost(sendText, getGroupMentions, { tagAll: !justCancelled })
    })
    .subscribe()

  supabase
    .channel('whatsapp-bot-participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, async (payload) => {
      // A promotion is an UPDATE from waitlisted -> confirmed (the
      // check_game_promote trigger). `old` is available because
      // participants has REPLICA IDENTITY FULL (migration_whatsapp_bot.sql).
      const isPromotion =
        payload.eventType === 'UPDATE' &&
        payload.old?.status === 'waitlisted' &&
        payload.new?.status === 'confirmed'

      if (!isPromotion) {
        // Always recomputed fresh from the DB at post time, and the hash
        // check above skips a no-op send — no need to pre-filter which
        // mix this row belongs to. Someone joining/leaving isn't a
        // create/edit, so this never tags @all.
        scheduleRepost(sendText, getGroupMentions)
        return
      }

      const { data: promotedProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', payload.new.user_id)
        .single()

      scheduleRepost(sendText, getGroupMentions, { promotedNames: [promotedProfile?.name || 'Jogador'] })
    })
    .subscribe()

  // Safety net: catches any change missed during a transient Realtime
  // disconnect, without spamming (only reposts if the combined roster
  // actually differs from what was last sent). Never tags @all — it's
  // not a new create/edit event, just catching up.
  setInterval(() => {
    postCombinedRoster(sendText, getGroupMentions).catch((err) =>
      console.error('Reconciliation tick failed:', err)
    )
  }, RECONCILE_INTERVAL_MS)
}
