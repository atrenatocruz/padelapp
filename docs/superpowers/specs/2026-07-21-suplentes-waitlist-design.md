# Suplentes (Waitlist) — Design

## Context

When a mix fills up today, the app just hides the join buttons and the WhatsApp bot replies "🤖 O mix já está completo! 😢 Fica atento à próxima." — there's no way to queue for a freed spot. The ask: let people join a waitlist ("suplentes") once a mix is full, and automatically promote the first suplente into a confirmed spot the moment someone leaves — from both the app and the WhatsApp bot.

## Data model

No schema migration needed beyond a new status value: `participants.status` is a free-text column with no CHECK constraint, so a suplente is just a normal `participants` row with `status = 'waitlisted'`. Solo only — `partner_id` stays null for waitlist rows (pairs each queue individually; a person who joined as someone's partner leaves the pair via the existing partner-removal flow, not this feature). Queue order is FIFO by `created_at`.

Guests can be suplentes (guests can already join solo today — `handleJoinAlone` has no `isGuest` gate). Admins can add someone directly as a suplente when a mix is full, mirroring the existing "Adicionar jogador de teste" direct-add flow used when there's an open spot.

## Promotion trigger

`supabase/schema.sql` currently has two triggers on `participants`:
- `check_game_full()` (AFTER INSERT OR UPDATE) — closes the game when confirmed headcount reaches capacity.
- `check_game_reopen()` (AFTER DELETE) — reopens a closed game when confirmed headcount drops below capacity.

Both are `SECURITY DEFINER` because the acting user (a regular member joining/leaving) isn't a games-admin and would otherwise be blocked by RLS on the `games` UPDATE.

Add `check_game_promote()`, replacing `check_game_reopen()`'s role for the AFTER-DELETE case (and also firing when a `confirmed` row is updated to `cancelled`, if that path is ever used — currently leaving is a hard DELETE, not a status change, so DELETE is the primary trigger point):

1. Compute confirmed headcount vs. capacity for the affected game, same as today.
2. If under capacity: look for the oldest `waitlisted` row for this game (`ORDER BY created_at LIMIT 1`).
   - If one exists: `UPDATE` it to `status = 'confirmed'`. This single UPDATE is what both the app's Realtime UI and the bot's roster repost pick up.
   - If none exists: fall through to today's `check_game_reopen()` behavior — reopen the game to `status = 'open'` if it was `closed`.
3. Promotion and reopening are mutually exclusive per freed slot — a promoted suplente immediately re-fills the slot, so the game only reopens for fresh signups once the waitlist is empty.

This merges into one function so there's a single, unambiguous order of operations instead of two independently-firing AFTER-DELETE triggers racing each other.

## Web app (`src/pages/GameDetails.jsx`)

**Loading suplentes:** the participants query at line ~89 currently filters `.eq('status', 'confirmed')`. Add a second query (or drop the status filter and split client-side) to also fetch `status = 'waitlisted'` rows, same `user:profiles!participants_user_id_fkey (...)` shape, ordered by `created_at`. Keep them in a separate `waitlist` state array — they must never count toward `peopleCount`/`capacity`.

**UI:**
- When `isFull` (peopleCount >= capacity) and the user isn't already joined or waitlisted, show an **"Entrar como suplente"** button where the hidden join buttons would otherwise be (near line 1086's `canJoin` block). Inserts a `participants` row with `status: 'waitlisted'`, no partner, mirroring `handleJoinAlone`'s shape.
- A new **"Suplentes"** section (below the main roster, same list style used for the numbered player slots) showing each waitlisted person with their queue position (1st, 2nd, …).
- A waitlisted user sees "Sair da lista de suplentes" instead of the normal join buttons — deletes their own `waitlisted` row, same mechanics as `handleLeaveGame` today.
- Admin's "Adicionar jogador de teste"-style direct-add, when `peopleCount >= capacity`, inserts as `waitlisted` instead of being hidden entirely.

No changes needed to `check_game_promote()`'s effect on the UI — it fires the same Postgres row UPDATE the app already listens to via its existing data-loading pattern (`loadGameDetails()` re-fetch on mutations); promotion elsewhere (e.g. someone else leaving) will show up on next load/Realtime refresh same as any other roster change.

## WhatsApp bot (`whatsapp-bot/src/`)

**New conversational state.** The bot (`commands.js`) is currently fully stateless — every message is parsed independently. Add an in-memory `Map` keyed by `` `${senderPn}:${groupJid}` `` → `{ gameId, expiresAt }`, TTL ~10 minutes. Lost on bot restart, which is an acceptable trade-off given restarts are rare and the worst case is the person just gets no response and can retry `"in"`.

**Flow change in `handleGroupMessage`:**
1. Before the existing `parseCommand` dispatch, check whether the sender has a live pending confirmation. If so, interpret this message as the answer instead of a fresh command:
   - Normalizes to "sim" → insert a `waitlisted` participants row for `{ gameId, senderPn }` (resolving profile same as the existing `resolveProfileOrReply` path). No explicit reply needed — the INSERT triggers the existing roster repost.
   - Normalizes to "não" → clear the pending state, no reply.
   - Anything else, on the *first* ambiguous reply → re-prompt once: "🤖 Não percebi 🤔 Responde só com *Sim* ou *Não*." A second ambiguous message before expiry is silently ignored (falls through to normal command parsing) rather than re-prompting again, to avoid the bot nagging into what might just be normal group chatter.
   - Expired pending state → falls through to normal parsing, unchanged.
2. In `actOnGame`, the existing `if (people.length >= capacity)` branch (currently just replies "O mix já está completo!") instead replies `"🤖 Mix cheio! Queres entrar como suplente? Responde com *Sim* ou *Não*."` and records the pending confirmation for that sender+game.

**Promotion callout.** `roster.js`'s Realtime subscription already reposts the full roster on any `participants` change (`event: '*'` in `sync.js`), so promotion (a plain `UPDATE ... SET status='confirmed'`) is automatically picked up with no new bot-initiated-message capability required. Add a small enhancement: when the payload that triggered a repost reflects a promotion (old status `waitlisted` → new status `confirmed`), prepend a callout line to the roster message, e.g. `"🎉 João subiu da lista de suplentes!"`, using the promoted person's name (looked up the same way `roster.js` already resolves names). If distinguishing "promotion" from "fresh join" from the Realtime payload proves awkward in practice, a plain repost (no callout) is an acceptable fallback — the roster itself already reflects the change either way.

## Edge cases (explicitly out of scope for this pass)

- Cancelling a mix needs no special waitlist cleanup — matches how confirmed participants are already handled (rows are left in place; `games.status = 'cancelled'` alone removes the mix from listings).
- Capacity-lowering edge cases (admin reduces `num_courts` below current confirmed headcount) are a pre-existing gap independent of this feature and aren't addressed here.
- Pairs queuing together as a single waitlist unit are not supported — each person in a pair queues individually if they want to be a suplente.

## Files touched

- `supabase/schema.sql` — replace `check_game_reopen()` with `check_game_promote()` (promote-then-reopen logic); update the trigger definition; comment explaining the merge.
- `supabase/migration_suplentes.sql` (new) — the same trigger change, for the already-live database.
- `src/pages/GameDetails.jsx` — waitlist query, "Entrar como suplente" button, "Suplentes" section, "Sair da lista de suplentes" action, admin direct-add-to-waitlist.
- `whatsapp-bot/src/commands.js` — pending-confirmation `Map`, sim/não handling, updated full-mix reply text.
- `whatsapp-bot/src/roster.js` — promotion callout line in the roster message builder (best-effort; plain repost is an acceptable fallback).
