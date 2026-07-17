# Round Timer + Admin Test Users — Design

## Context

Two independent, small features requested together:

1. Rounds currently have no timer — the admin ends each round manually with no time pressure indicator. We want a per-round countdown, visible to everyone in the mix, defaulting to the mix's configured game time, adjustable per-round by the admin, with an audible alert (admin device only) when it hits zero.
2. Admins have no way to quickly populate a mix with fake players to test round-generation/timer/scoring flows. The old guest-login feature was removed (commit `f9f17e1`), but its underlying data model (`memberships.is_guest`, stats exclusion, `GuestBadge`) is still fully wired up and simply unused — we reuse it rather than building a parallel system.

## A) Round timer

### Data model

Add two nullable columns to `games`:

- `round_started_at TIMESTAMPTZ` — when the current round was drawn. `NULL` before round 1 starts or once the mix is finalized.
- `round_duration_minutes INTEGER` — this round's duration. Set to `game_time_minutes` (the mix's default) every time a new round is drawn; editable by the admin afterward without touching the mix-wide default.

### Round start/advance

Both `handleStartRound1` and the "end round → draw next round" handler in `GameDetails.jsx` already write the new round's `matches` rows in one Supabase call. Extend both to also `UPDATE games SET round_started_at = now(), round_duration_minutes = game_time_minutes WHERE id = :id` in the same action (two calls, no new RPC needed — both already run under the existing "Org admins can update games" RLS policy).

When the mix finishes (finalize), clear `round_started_at` back to `NULL` so no stale countdown lingers.

### Live sync

`GameDetails.jsx` already subscribes to `postgres_changes` UPDATE events on `games` (filtered by `id`) and calls `loadGameDetails()` on every change — this already covers the new columns with no additional subscription work. Every open device picks up a new round's start time or a duration adjustment automatically.

### Countdown UI

A small client-side ticking display (`setInterval`, 1s) computed as:

```
remaining = round_started_at + round_duration_minutes*60000 - Date.now()
```

Shown in the "current round" card, visible to every viewer (admin and players) whenever `game.status === 'in_progress'` and `round_started_at` is set. Formatted `MM:SS`, clamped to `00:00` at zero (never negative).

### Admin duration adjustment

Admin-only inline control next to the countdown (e.g. `-5` / `+5` min buttons, or a small stepper) that updates `games.round_duration_minutes` directly. This only ever affects the *current* round — the next round drawn resets to `game_time_minutes` again, per the "adjust only this round" decision.

### Sound alert (admin only)

When the countdown reaches zero:
- On every device: countdown visually turns to a "time's up" state (e.g. red text/pulsing `00:00`).
- Only on the admin's own device (`isAdmin` client-side check, not a server broadcast): play a short local alert sound once via the Web Audio API / an `<audio>` element bundled as a static asset. No sound fires on non-admin devices even though they see the same `00:00` state.

This is purely a client-side trigger keyed off `isAdmin` — no new backend concept, since only the viewer's own role gates the sound.

## B) Admin: add test users to a mix

### Data model

Add `memberships.is_test BOOLEAN NOT NULL DEFAULT FALSE`. Kept separate from `is_guest` (which test users also get set to `true`, to inherit every existing guest behavior — stats exclusion, hidden from the partner-picker member list, `GuestBadge`-style treatment) so that:
- Real historic guest memberships (from before guest-login was removed) aren't relabeled as test data.
- A future cleanup pass can target `is_test = true` specifically without touching real guests.

### Creating a test user

Client-side alone can't do this: `profiles.id` is a hard foreign key to `auth.users`, so a fake profile needs a real (if never-logged-into) Supabase Auth user behind it — not something the anon/authenticated client role can create directly.

New Edge Function `supabase/functions/admin-create-test-user`, mirroring the existing `hash-phone` function's access-control pattern:
- Rejects the `anon` role outright (decodes the caller's JWT, requires `authenticated`).
- Input: `{ organization_id }`.
- Verifies the caller is an admin of that org (service-role query against `memberships`, same check as `is_org_admin()`).
- Calls `supabase.auth.admin.createUser({ email: <generated unique fake address>, email_confirm: true, password: <random>, user_metadata: { name: "Teste N" } })` — the officially supported way to create a real Auth user server-side. The existing `handle_new_user` trigger on `auth.users` already creates the matching `profiles` row from `user_metadata`, so no manual profile insert is needed.
- Inserts the `memberships` row (`organization_id`, `user_id` = new user, `is_admin = false`, `is_guest = true`, `is_test = true`, `level = 'iniciante'`) using the service-role client (bypasses RLS, same as other admin RPCs in this codebase).
- Returns the new `user_id` (and name) to the caller.

`N` in "Teste N" is derived from a count of existing `is_test = true` memberships in that org + 1, computed inside the function so concurrent clicks can't collide on the same name.

### Joining the mix

The client (already authenticated as the admin who owns this action) inserts the `participants` row itself: `{ game_id, user_id: <returned id>, status: 'confirmed', joined_alone: true }`. No new RLS policy needed — "Org admins can manage participants" (`FOR ALL`, not restricted to `auth.uid() = user_id`) already permits an admin to insert a participant row for any user_id within their org.

### UI

- New button "Adicionar jogador de teste" in `GameDetails.jsx`, admin-only, shown alongside the existing join actions whenever `!mixStarted` and there's remaining capacity. One click = one immediately-added test player, no form.
- `GuestBadge` gains a `label` prop (default `"Convidado"`); rendered with `label="Teste"` for people whose membership has `is_test = true`, keeping the same dashed-border visual style.
- Removal reuses the existing `handleRemovePerson` flow unchanged — it deletes the `participants` row only, leaving the underlying test profile/membership intact for reuse in future test mixes.

### Known limitation (accepted, not building now)

Test profiles/memberships accumulate over time (nothing deletes them). No cleanup UI is being built in this pass — acceptable for now since they're inert (excluded from stats, hidden from real member pickers); revisit if it becomes noisy in the Admin members list.

## Files touched

- `supabase/migration_round_timer_and_test_users.sql` (new) — `games.round_started_at`, `games.round_duration_minutes`, `memberships.is_test`
- `supabase/functions/admin-create-test-user/index.ts` (new)
- `src/pages/GameDetails.jsx` — round start/advance writes timer columns; countdown display; admin duration control; sound alert; "Adicionar jogador de teste" button
- `src/components/ui.jsx` — `GuestBadge` gains `label` prop; new countdown display component
- Small bundled alert-sound asset (e.g. `src/assets/round-end.mp3` or similar)
