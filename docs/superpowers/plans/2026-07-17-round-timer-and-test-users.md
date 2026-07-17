# Round Timer + Admin Test Users Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-round countdown timer (server-persisted, visible to everyone, admin-adjustable, with an admin-only sound alert at zero) and an admin-only "add test player" action to quickly fill a mix for testing.

**Architecture:** Round timing lives on `games.round_started_at` / `games.round_duration_minutes`, written whenever a round is drawn or advanced; the app's existing Realtime subscription to `games` UPDATE events already pushes it to every open device with no new wiring. Test users are real (if never-logged-into) Supabase Auth users created server-side by a new Edge Function — required because `profiles.id` is a hard FK to `auth.users` — tagged with a new `memberships.is_test` column layered on top of the already-present (currently unused) `is_guest` machinery.

**Tech Stack:** React (Vite), Supabase (Postgres + RLS + Realtime + Edge Functions/Deno), Tailwind.

## Global Constraints

- No JS test framework exists in this repo (`package.json` has no test script, no test files anywhere) — verification is `npx vite build` (compile-time correctness) plus manual click-through in the browser, matching how every other feature in this codebase has been verified. Do not introduce a new test framework as part of this plan.
- SQL migrations in this repo are applied by the user manually in the Supabase SQL Editor — writing/committing the `.sql` file is the deliverable; running it is called out explicitly as a manual step, not something the implementer can verify programmatically.
- Portuguese user-facing copy throughout, matching the rest of the app.
- Follow existing file conventions: shared components go in `src/components/ui.jsx`; Edge Functions follow the `hash-phone` pattern (CORS headers, `jsonResponse` helper, explicit anon-role rejection).

---

## Task 1: Database migration — round timer + test-user columns

**Files:**
- Create: `supabase/migration_round_timer_and_test_users.sql`

**Interfaces:**
- Produces: `games.round_started_at` (TIMESTAMPTZ, nullable), `games.round_duration_minutes` (INTEGER, nullable), `memberships.is_test` (BOOLEAN NOT NULL DEFAULT FALSE) — every later task in this plan reads/writes these exact column names.

- [ ] **Step 1: Write the migration file**

```sql
-- ════════════════════════════════════════════════════════════════════════
-- Round timer + admin test users.
--
-- round_started_at / round_duration_minutes track the CURRENT round only —
-- reset every time a new round is drawn, cleared to NULL when the mix is
-- finalized. NULL means "no round in progress right now".
--
-- is_test reuses the existing (currently unreachable, since guest login
-- was removed) is_guest machinery for stats-exclusion and partner-picker
-- hiding — test users get is_guest = true AND is_test = true. Kept as a
-- separate column so real historic guest memberships (from before guest
-- login was removed) never get relabeled as test data.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE games ADD COLUMN IF NOT EXISTS round_started_at TIMESTAMPTZ;
ALTER TABLE games ADD COLUMN IF NOT EXISTS round_duration_minutes INTEGER;

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Verify the file is valid SQL by re-reading it**

There's no local Postgres to run this against. Re-read the file and confirm: every statement ends in `;`, both `ALTER TABLE` statements use `IF NOT EXISTS` (safe to re-run), and the new `memberships` column has `NOT NULL DEFAULT FALSE` (so existing rows don't end up with `NULL`, which would make `is_test = true` filters silently miss them).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_round_timer_and_test_users.sql
git commit -m "Add round timer and test-user columns"
```

**Note for whoever runs this in production:** after this commit is deployed, the migration file still needs to be run manually in Supabase → SQL Editor. Nothing in the app uses these columns until Task 3 onward ships, so there's no urgency, but Task 3+ will silently no-op (timer never appears) until it's applied.

---

## Task 2: `RoundTimer` component

**Files:**
- Modify: `src/components/ui.jsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `RoundTimer({ startedAt, durationMinutes, isAdmin, onAdjust })` — a countdown display. `startedAt` is an ISO timestamp string or `null`/`undefined` (renders nothing). `durationMinutes` is a number or `null`/`undefined` (renders nothing). `isAdmin` is a boolean — gates both the +/- adjust buttons and whether this device plays the expiry sound. `onAdjust(deltaMinutes: number)` is an optional callback fired when the admin taps -5/+5; omit it (or pass `isAdmin={false}`) to hide those controls. Task 4 renders this component and implements `onAdjust`.

- [ ] **Step 1: Add the new imports**

In `src/components/ui.jsx`, the file currently starts with:

```jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MapPin, CheckCircle2, ChevronRight, Lock, Play, Calendar, X, Share2, MessageCircle, Link2 } from 'lucide-react'
```

Replace those four lines with:

```jsx
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MapPin, CheckCircle2, ChevronRight, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```

- [ ] **Step 2: Add the `RoundTimer` component**

Append this to the end of `src/components/ui.jsx` (after the closing `}` of `ShareModal`):

```jsx
// Three short beeps via the Web Audio API — no bundled audio asset, works
// offline as a PWA, and needs no license. Wrapped in try/catch: Web Audio
// can be unavailable or blocked by autoplay policy on some browsers: the
// visual "00:00" state is still enough of a signal if the beep is silently
// skipped.
function playRoundEndBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    ;[0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.25)
    })
  } catch {
    // Web Audio unavailable — silent fallback.
  }
}

/* Per-round countdown. Visible to everyone; the +/- adjust controls and
   the expiry beep are admin-only. `startedAt`/`durationMinutes` come
   straight from the `games` row, which every open device already receives
   live via the existing Realtime subscription on games UPDATE — no new
   sync mechanism needed here. */
export function RoundTimer({ startedAt, durationMinutes, isAdmin, onAdjust }) {
  const [now, setNow] = useState(Date.now())
  const alertedRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Re-arm the alert whenever a new round starts, or the admin extends a
  // round that had already rung once (so it can ring again at the new end).
  useEffect(() => {
    alertedRef.current = false
  }, [startedAt, durationMinutes])

  const endTime = startedAt ? new Date(startedAt).getTime() + (durationMinutes || 0) * 60000 : null
  const remainingMs = endTime !== null ? Math.max(0, endTime - now) : null
  const expired = remainingMs !== null && remainingMs <= 0

  useEffect(() => {
    if (expired && isAdmin && !alertedRef.current) {
      alertedRef.current = true
      playRoundEndBeep()
    }
  }, [expired, isAdmin])

  if (!startedAt || !durationMinutes) return null

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const ss = (totalSeconds % 60).toString().padStart(2, '0')

  return (
    <div className={`inline-flex items-center gap-2 ${expired ? 'text-danger animate-pulse' : 'text-court-900'}`}>
      <Clock size={16} className="shrink-0" />
      <span className="font-extrabold tabular-nums text-sm">{mm}:{ss}</span>
      {isAdmin && onAdjust && (
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => onAdjust(-5)}
            aria-label="Menos 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-court-100 text-court-700 text-xs font-extrabold hover:bg-court-200 transition-colors duration-fast"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => onAdjust(5)}
            aria-label="Mais 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-court-100 text-court-700 text-xs font-extrabold hover:bg-court-200 transition-colors duration-fast"
          >
            +5
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors (this only proves the file is syntactically valid and type-consistent with its own usage — `RoundTimer` has no caller yet, so there's nothing to click through until Task 3).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui.jsx
git commit -m "Add RoundTimer component"
```

---

## Task 3: Wire the round timer into GameDetails

**Files:**
- Modify: `src/pages/GameDetails.jsx`

**Interfaces:**
- Consumes: `RoundTimer` from Task 2 (`src/components/ui.jsx`), exact signature `RoundTimer({ startedAt, durationMinutes, isAdmin, onAdjust })`.
- Consumes: `games.round_started_at`, `games.round_duration_minutes` from Task 1.

- [ ] **Step 1: Import `RoundTimer`**

Find this line near the top of `src/pages/GameDetails.jsx`:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal, RoundTimer } from '../components/ui'
```

- [ ] **Step 2: Stamp the timer when round 1 starts**

Find `handleStartRound1`:

```jsx
  const handleStartRound1 = async () => {
    setBusy(true)
    setMixError('')
    try {
      const numCourts = game.num_courts || 1
      const rows = isSobeDesce
        ? seedCourts(teams, numCourts)
        : roundRobinRound(orderedTeamIds(), numCourts, 0)

      const { error } = await supabase.from('matches').insert(
        rows.map(m => ({ ...m, game_id: id, round_number: 1, phase: 'group' }))
      )
      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error starting round 1:', error)
      setMixError(error.message || 'Erro ao iniciar a ronda 1')
    } finally {
      setBusy(false)
    }
  }
```

Replace with:

```jsx
  const handleStartRound1 = async () => {
    setBusy(true)
    setMixError('')
    try {
      const numCourts = game.num_courts || 1
      const rows = isSobeDesce
        ? seedCourts(teams, numCourts)
        : roundRobinRound(orderedTeamIds(), numCourts, 0)

      const { error } = await supabase.from('matches').insert(
        rows.map(m => ({ ...m, game_id: id, round_number: 1, phase: 'group' }))
      )
      if (error) throw error

      const { error: timerError } = await supabase
        .from('games')
        .update({ round_started_at: new Date().toISOString(), round_duration_minutes: game.game_time_minutes })
        .eq('id', id)
      if (timerError) throw timerError

      loadGameDetails()
    } catch (error) {
      console.error('Error starting round 1:', error)
      setMixError(error.message || 'Erro ao iniciar a ronda 1')
    } finally {
      setBusy(false)
    }
  }
```

- [ ] **Step 3: Stamp the timer when a round advances**

Find `handleAdvance`:

```jsx
      const { error } = await supabase.from('matches').insert(
        rows.map(m => ({ ...m, game_id: id, round_number: maxRound + 1, phase }))
      )
      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error ending round:', error)
      setMixError(error.message || 'Erro ao terminar a ronda')
    } finally {
      setBusy(false)
    }
  }
```

Replace with:

```jsx
      const { error } = await supabase.from('matches').insert(
        rows.map(m => ({ ...m, game_id: id, round_number: maxRound + 1, phase }))
      )
      if (error) throw error

      const { error: timerError } = await supabase
        .from('games')
        .update({ round_started_at: new Date().toISOString(), round_duration_minutes: game.game_time_minutes })
        .eq('id', id)
      if (timerError) throw timerError

      loadGameDetails()
    } catch (error) {
      console.error('Error ending round:', error)
      setMixError(error.message || 'Erro ao terminar a ronda')
    } finally {
      setBusy(false)
    }
  }
```

- [ ] **Step 4: Clear the timer when the mix is finalized**

Find `handleFinalize`:

```jsx
      const { error } = await supabase.rpc('finalize_mix', {
        p_game_id: id,
        p_winner_team_id: currentWinnerTeamId,
      })
      if (error) throw error
      loadGameDetails()
```

Replace with:

```jsx
      const { error } = await supabase.rpc('finalize_mix', {
        p_game_id: id,
        p_winner_team_id: currentWinnerTeamId,
      })
      if (error) throw error

      await supabase.from('games').update({ round_started_at: null }).eq('id', id)

      loadGameDetails()
```

- [ ] **Step 5: Add the admin duration-adjust handler**

Directly below `handleFinalize` (after its closing `}`), add:

```jsx
  const handleAdjustRoundDuration = async (deltaMinutes) => {
    const base = game.round_duration_minutes || game.game_time_minutes || 20
    const next = Math.max(1, base + deltaMinutes)
    try {
      const { error } = await supabase.from('games').update({ round_duration_minutes: next }).eq('id', id)
      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error adjusting round duration:', error)
      setMixError('Erro ao ajustar o tempo da ronda')
    }
  }
```

- [ ] **Step 6: Render the timer on the current round's card**

Find (inside the rounds-rendering block):

```jsx
                  {isCurrent && <span className="text-xs font-extrabold text-court-600">RONDA ATUAL</span>}
```

Replace with:

```jsx
                  {isCurrent && (
                    <RoundTimer
                      startedAt={game.round_started_at}
                      durationMinutes={game.round_duration_minutes}
                      isAdmin={isAdmin}
                      onAdjust={isAdmin ? handleAdjustRoundDuration : undefined}
                    />
                  )}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 8: Manual verification in the browser**

Run `npm run dev`, open a mix as an admin, get it to "in progress" with duplas formed, then:
1. Tap "Iniciar Ronda 1" → the current round's card should immediately show a counting-down `MM:SS` next to a clock icon, starting from the mix's configured game time (e.g. `20:00`).
2. As admin, tap `−5` / `+5` next to the timer → the displayed time should jump by 5 minutes immediately (no page reload needed).
3. Open the same mix in a second browser/incognito window as a non-admin member → confirm the timer is visible there too, ticking in sync, but with no `−5`/`+5` buttons.
4. For a quick end-to-end check of the zero/beep state without waiting 20 minutes: temporarily run `UPDATE games SET round_duration_minutes = 1 WHERE id = '<this game id>';` in the Supabase SQL Editor (this requires Task 1's migration to already be applied), then watch it count down — at zero it should turn red/pulse on every device, and only the **admin's** browser tab should play a triple beep.
5. Tap "Terminar Ronda 1" (or finalize the mix) → confirm the next round's timer resets to the full default duration, and after finalizing, no timer is shown anymore.

- [ ] **Step 9: Commit**

```bash
git add src/pages/GameDetails.jsx
git commit -m "Wire round timer into GameDetails"
```

---

## Task 4: `admin-create-test-user` Edge Function

**Files:**
- Create: `supabase/functions/admin-create-test-user/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/admin-create-test-user` — request body `{ organization_id: string }`, requires an `Authorization: Bearer <token>` header for a real `authenticated`-role session belonging to an admin of that org. Response `{ user_id: string, name: string }` on success. Task 5 calls this via `supabase.functions.invoke('admin-create-test-user', { body: { organization_id } })`.

- [ ] **Step 1: Write the Edge Function**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/admin-create-test-user/index.ts
git commit -m "Add admin-create-test-user Edge Function"
```

- [ ] **Step 3: Deploy and verify (manual, requires Supabase CLI access)**

```bash
supabase functions deploy admin-create-test-user
```

Then verify access control with `curl`, using the project's public anon key (found in Supabase → Project Settings → API):

```bash
curl -i -X POST 'https://<project-ref>.supabase.co/functions/v1/admin-create-test-user' \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `401 Unauthorized` (the anon key's JWT role is `anon`, not `authenticated`) — this is the check that stops the function being an open "create a user for me" oracle.

Full success path is verified end-to-end in Task 5 (once there's a UI button to trigger it from a real admin session).

---

## Task 5: "Adicionar jogador de teste" button + `is_test` badge

**Files:**
- Modify: `src/pages/GameDetails.jsx`
- Modify: `src/components/ui.jsx`

**Interfaces:**
- Consumes: `admin-create-test-user` Edge Function from Task 4, called as `supabase.functions.invoke('admin-create-test-user', { body: { organization_id } })`, returning `{ user_id, name }`.
- Consumes: `memberships.is_test` from Task 1.
- Modifies: `GuestBadge` gains a `label` prop (default `'Convidado'`), used elsewhere in the codebase (`GameDetails.jsx:811` renders `<GuestBadge />` with no props) — passing no `label` must keep rendering "Convidado" exactly as today.

- [ ] **Step 1: Add the `label` prop to `GuestBadge`**

In `src/components/ui.jsx`, find:

```jsx
export function GuestBadge({ size = 'sm' }) {
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title="Jogador convidado"
      className={`inline-flex items-center rounded-full font-extrabold tracking-wide uppercase
                  border border-dashed border-court-200 bg-sand text-muted ${sizes[size]}`}
    >
      Convidado
    </span>
  )
}
```

Replace with:

```jsx
export function GuestBadge({ size = 'sm', label = 'Convidado' }) {
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title={label === 'Teste' ? 'Jogador de teste (admin)' : 'Jogador convidado'}
      className={`inline-flex items-center rounded-full font-extrabold tracking-wide uppercase
                  border border-dashed border-court-200 bg-sand text-muted ${sizes[size]}`}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Carry `is_test` through `attachMembership` in `GameDetails.jsx`**

Find:

```jsx
      const { data: memberRows, error: memberError } = await supabase
        .from('memberships')
        .select('user_id, level, is_guest')
        .eq('organization_id', gameData.organization_id)
      if (memberError) throw memberError
      const membershipByUser = new Map((memberRows || []).map((m) => [m.user_id, m]))
      const attachMembership = (p) => {
        if (!p) return p
        const m = membershipByUser.get(p.id)
        return { ...p, level: m?.level, is_guest: m?.is_guest ?? false }
      }
```

Replace with:

```jsx
      const { data: memberRows, error: memberError } = await supabase
        .from('memberships')
        .select('user_id, level, is_guest, is_test')
        .eq('organization_id', gameData.organization_id)
      if (memberError) throw memberError
      const membershipByUser = new Map((memberRows || []).map((m) => [m.user_id, m]))
      const attachMembership = (p) => {
        if (!p) return p
        const m = membershipByUser.get(p.id)
        return { ...p, level: m?.level, is_guest: m?.is_guest ?? false, is_test: m?.is_test ?? false }
      }
```

- [ ] **Step 3: Show the "Teste" label in the pre-mix players list**

Find:

```jsx
                  {person.is_guest
                    ? <GuestBadge />
                    : <LevelBadge level={person.level} />}
```

Replace with:

```jsx
                  {person.is_guest
                    ? <GuestBadge label={person.is_test ? 'Teste' : 'Convidado'} />
                    : <LevelBadge level={person.level} />}
```

- [ ] **Step 4: Add state and the handler for adding a test user**

Find:

```jsx
  const [showShare, setShowShare] = useState(false)
  const [mixStats, setMixStats] = useState([])
```

Replace with:

```jsx
  const [showShare, setShowShare] = useState(false)
  const [mixStats, setMixStats] = useState([])
  const [addingTestUser, setAddingTestUser] = useState(false)
```

Then, directly below `handleJoinWithPartner` (after its closing `}`), add:

```jsx
  const handleAddTestUser = async () => {
    setAddingTestUser(true)
    setJoinError('')
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-test-user', {
        body: { organization_id: currentOrganizationId },
      })
      if (error) throw error

      const { error: participantError } = await supabase
        .from('participants')
        .insert([{ game_id: id, user_id: data.user_id, status: 'confirmed', joined_alone: true }])
      if (participantError) throw participantError

      loadGameDetails()
    } catch (error) {
      console.error('Error adding test user:', error)
      setJoinError('Não foi possível adicionar o jogador de teste.')
    } finally {
      setAddingTestUser(false)
    }
  }
```

- [ ] **Step 5: Add the button**

Find:

```jsx
          {canJoin && !joinMode && (
```

Insert directly above it (still inside the `{!mixStarted && (<div className="space-y-3">` block, after the `joinError` block):

```jsx
          {isAdmin && peopleCount < capacity && (
            <PrimaryButton
              variant="ghost"
              onClick={handleAddTestUser}
              disabled={addingTestUser}
              className="w-full"
            >
              <UserPlus size={19} />
              {addingTestUser ? 'A adicionar…' : 'Adicionar jogador de teste'}
            </PrimaryButton>
          )}

          {canJoin && !joinMode && (
```

(`UserPlus` is already imported in this file — it's used a few lines below for "Entrar com parceiro".)

- [ ] **Step 6: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 7: Manual verification in the browser**

This requires Task 4's Edge Function to already be deployed (`supabase functions deploy admin-create-test-user`) and Task 1's migration applied.

1. As an admin, open an unstarted mix with free slots → confirm "Adicionar jogador de teste" is visible (and not visible to a non-admin viewing the same mix).
2. Tap it → within a couple seconds, a new player named "Teste 1" appears in the players list with a dashed "TESTE" badge (not "CONVIDADO"), and the button is disabled/shows "A adicionar…" while in flight.
3. Tap it again → "Teste 2" is added.
4. Confirm capacity still caps it — once the mix is full, the button should disappear like the normal join buttons do.
5. Start the mix with these test players in the pool → confirm they get paired into duplas and appear in rounds like any real player (no special-casing needed here — this is exercising Task 3's round logic with fake data, not new code).
6. As admin, remove a "Teste" player via the existing `X` remove button → confirms removal reuses the existing flow unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/pages/GameDetails.jsx src/components/ui.jsx
git commit -m "Add admin test-user creation to mixes"
```
