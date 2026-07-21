# Suplentes (Waitlist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a mix is full, let people join a "Suplentes" (waitlist) queue — from the app or the WhatsApp bot — and automatically promote the first suplente into a confirmed spot the moment someone leaves.

**Architecture:** A suplente is a `participants` row with `status = 'waitlisted'` (no schema migration needed — `status` has no CHECK constraint). A new `check_game_promote()` trigger replaces `check_game_reopen()`: on any `participants` DELETE, it promotes oldest-first from the waitlist to fill freed slots (looping to handle a pair leaving and freeing 2 slots at once), and only reopens the game for fresh signups once the waitlist is empty. The web app gets a new "Entrar como suplente" button and a visible "Suplentes" list with queue position. The WhatsApp bot, currently fully stateless, gains a small in-memory pending-confirmation map so a "Sim"/"Não" reply to "queres entrar como suplente?" is understood as an answer rather than a fresh command. Promotion is a plain `participants` UPDATE, which both the app's existing Realtime subscription and the bot's existing roster-repost listener already react to — the bot additionally gets a "🎉 X subiu da lista de suplentes!" callout line on that repost.

**Tech Stack:** React (Vite) + Supabase (Postgres, RLS, Realtime) for the app; Node.js (ESM) + Baileys + Supabase (service-role client) for the WhatsApp bot.

**Design doc:** `docs/superpowers/specs/2026-07-21-suplentes-waitlist-design.md`

## Global Constraints

- No JS test framework exists in this repo (neither `package.json` nor `whatsapp-bot/package.json` has a test script or any test files) — verification is `npx vite build` for the app (compile-time correctness) and `node --check <file>` for the bot (syntax correctness), plus a written manual QA checklist per task. Do not introduce a new test framework as part of this plan.
- SQL migrations in this repo are applied by the user manually in the Supabase SQL Editor — writing/committing the `.sql` file is the deliverable; running it is a manual step, not something the implementer can verify programmatically.
- Portuguese user-facing copy throughout, matching the rest of the app and bot.
- Suplentes are solo only — `partner_id` always null on `waitlisted` rows. Queue order is FIFO by `created_at`.
- All work happens on branch `feature/suplentes-waitlist` (already created off `dev`). Do not merge to `dev` or `main` as part of this plan — that's a separate, deliberate step after review.

---

## Task 1: Database — promotion trigger

**Files:**
- Modify: `supabase/schema.sql:376-391` (the `check_game_reopen()` function + `game_reopen_trigger`)
- Create: `supabase/migration_suplentes.sql`

**Interfaces:**
- Produces: `participants.status = 'waitlisted'` as a valid, recognized value (used by every later task); trigger `game_promote_trigger` (replaces `game_reopen_trigger`) calling `check_game_promote()`.

- [ ] **Step 1: Replace `check_game_reopen()` in `schema.sql`**

Find this block (`supabase/schema.sql:376-391`):

```sql
-- Reopen a closed (not started) game when someone leaves and frees a slot.
CREATE OR REPLACE FUNCTION check_game_reopen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE games g SET status = 'open', updated_at = NOW()
  WHERE g.id = OLD.game_id AND g.status = 'closed'
    AND (SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
         FROM participants WHERE game_id = OLD.game_id AND status = 'confirmed')
        < COALESCE(g.max_players, g.num_courts * 4);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER game_reopen_trigger
AFTER DELETE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_reopen();
```

Replace it with:

```sql
-- Promote suplentes (waitlisted participants) into freed slots when someone
-- leaves, oldest-first; only reopens the game for fresh signups once the
-- waitlist is empty. Loops because a single DELETE can free 2 slots at
-- once (a pair leaving), and suplentes are solo — one promotion per slot.
CREATE OR REPLACE FUNCTION check_game_promote()
RETURNS TRIGGER AS $$
DECLARE
  cap INTEGER;
  people INTEGER;
  v_waitlisted_id UUID;
BEGIN
  SELECT COALESCE(max_players, num_courts * 4) INTO cap FROM games WHERE id = OLD.game_id;

  LOOP
    SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
      INTO people
      FROM participants
     WHERE game_id = OLD.game_id AND status = 'confirmed';

    EXIT WHEN people >= cap;

    SELECT id INTO v_waitlisted_id
      FROM participants
     WHERE game_id = OLD.game_id AND status = 'waitlisted'
     ORDER BY created_at
     LIMIT 1;

    EXIT WHEN v_waitlisted_id IS NULL;

    UPDATE participants SET status = 'confirmed' WHERE id = v_waitlisted_id;
  END LOOP;

  -- No one left to promote but a slot is still free — reopen for fresh
  -- signups, same condition check_game_reopen used to check.
  SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
    INTO people
    FROM participants
   WHERE game_id = OLD.game_id AND status = 'confirmed';

  IF people < cap THEN
    UPDATE games SET status = 'open', updated_at = NOW()
    WHERE id = OLD.game_id AND status = 'closed';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER game_promote_trigger
AFTER DELETE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_promote();
```

- [ ] **Step 2: Write the migration file for the already-live database**

Create `supabase/migration_suplentes.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════
-- Suplentes (waitlist): a participant row with status = 'waitlisted' is a
-- suplente — no column changes needed, `status` has no CHECK constraint.
--
-- Replaces check_game_reopen() with check_game_promote(): on someone
-- leaving, promote the oldest waitlisted participant(s) into the freed
-- slot(s) before considering whether to reopen the game for fresh
-- signups. Loops to handle a pair leaving (2 freed slots) by promoting up
-- to 2 solo suplentes.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS game_reopen_trigger ON participants;
DROP FUNCTION IF EXISTS check_game_reopen();

CREATE OR REPLACE FUNCTION check_game_promote()
RETURNS TRIGGER AS $$
DECLARE
  cap INTEGER;
  people INTEGER;
  v_waitlisted_id UUID;
BEGIN
  SELECT COALESCE(max_players, num_courts * 4) INTO cap FROM games WHERE id = OLD.game_id;

  LOOP
    SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
      INTO people
      FROM participants
     WHERE game_id = OLD.game_id AND status = 'confirmed';

    EXIT WHEN people >= cap;

    SELECT id INTO v_waitlisted_id
      FROM participants
     WHERE game_id = OLD.game_id AND status = 'waitlisted'
     ORDER BY created_at
     LIMIT 1;

    EXIT WHEN v_waitlisted_id IS NULL;

    UPDATE participants SET status = 'confirmed' WHERE id = v_waitlisted_id;
  END LOOP;

  SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
    INTO people
    FROM participants
   WHERE game_id = OLD.game_id AND status = 'confirmed';

  IF people < cap THEN
    UPDATE games SET status = 'open', updated_at = NOW()
    WHERE id = OLD.game_id AND status = 'closed';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER game_promote_trigger
AFTER DELETE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_promote();
```

- [ ] **Step 3: Verify both files by re-reading them**

There's no local Postgres to run this against. Re-read both files and confirm: every statement ends in `;`, the migration file's `DROP TRIGGER`/`DROP FUNCTION` come before the `CREATE`s, and the function body in `schema.sql` is byte-for-byte the same as in the migration file (both must define the same trigger behavior — one for fresh installs, one for the live DB).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql supabase/migration_suplentes.sql
git commit -m "Add suplentes waitlist promotion trigger"
```

**Note for whoever runs this in production:** after this commit is deployed, `migration_suplentes.sql` still needs to be run manually in Supabase → SQL Editor. Until it is, `check_game_reopen()`'s old behavior (plain reopen, no promotion) stays in effect — no regression, just no promotion yet. Task 2/3 UI changes that insert `status: 'waitlisted'` rows work regardless of whether this migration has run (the rows just sit there until a departure triggers a reopen instead of a promotion).

---

## Task 2: Web app — suplente join/leave + Suplentes list

**Files:**
- Modify: `src/pages/GameDetails.jsx`

**Interfaces:**
- Consumes: `participants.status = 'waitlisted'` (Task 1).
- Produces: `waitlist` state (array of participant rows with `.user` attached, ordered by `created_at`), `handleJoinAsSuplente()`, `handleLeaveWaitlist()` — no other task depends on these names.

- [ ] **Step 1: Add `waitlist` state**

In `src/pages/GameDetails.jsx`, find:

```jsx
  const [participants, setParticipants] = useState([])
```

Replace with:

```jsx
  const [participants, setParticipants] = useState([])
  const [waitlist, setWaitlist] = useState([])
```

- [ ] **Step 2: Fetch both confirmed and waitlisted rows in one query**

Find (inside `loadGameDetails`):

```jsx
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, preferred_side, avatar_url),
          partner:profiles!participants_partner_id_fkey (id, name, preferred_side, avatar_url)
        `)
        .eq('game_id', id)
        .eq('status', 'confirmed')

      if (participantsError) throw participantsError
```

Replace with:

```jsx
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, preferred_side, avatar_url),
          partner:profiles!participants_partner_id_fkey (id, name, preferred_side, avatar_url)
        `)
        .eq('game_id', id)
        .in('status', ['confirmed', 'waitlisted'])
        .order('created_at')

      if (participantsError) throw participantsError

      const confirmedRows = (participantsData || []).filter((p) => p.status === 'confirmed')
      const waitlistRows = (participantsData || []).filter((p) => p.status === 'waitlisted')
```

- [ ] **Step 3: Store confirmed and waitlisted rows separately**

Find:

```jsx
      setParticipants((participantsData || []).map((p) => ({
        ...p,
        user: attachMembership(p.user),
        partner: attachMembership(p.partner),
      })))
```

Replace with:

```jsx
      setParticipants((confirmedRows || []).map((p) => ({
        ...p,
        user: attachMembership(p.user),
        partner: attachMembership(p.partner),
      })))
      setWaitlist((waitlistRows || []).map((p) => ({
        ...p,
        user: attachMembership(p.user),
      })))
```

- [ ] **Step 4: Run the build to confirm no syntax errors so far**

Run: `npx vite build`
Expected: build succeeds (exit code 0), no errors referencing `GameDetails.jsx`.

- [ ] **Step 5: Let admin's direct-add insert as waitlisted when the mix is full**

Find:

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

Replace with:

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
        .insert([{
          game_id: id,
          user_id: data.user_id,
          status: peopleCount < capacity ? 'confirmed' : 'waitlisted',
          joined_alone: true,
        }])
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

- [ ] **Step 6: Add `handleJoinAsSuplente` and `handleLeaveWaitlist`**

Find:

```jsx
  const handleLeaveGame = async () => {
    if (!confirm('Tens a certeza que queres sair deste jogo?')) return

    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('game_id', id)
        .eq('user_id', user.id)

      if (error) throw error
      // (a DB trigger reopens the game if it was closed and a slot freed up)
      loadGameDetails()
    } catch (error) {
      console.error('Error leaving game:', error)
      alert('Erro ao sair do jogo. Tenta novamente.')
    }
  }
```

Replace with (adds two new functions right after `handleLeaveGame`):

```jsx
  const handleLeaveGame = async () => {
    if (!confirm('Tens a certeza que queres sair deste jogo?')) return

    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('game_id', id)
        .eq('user_id', user.id)

      if (error) throw error
      // (a DB trigger promotes the first suplente, or reopens the game if
      // the waitlist is empty and it was closed)
      loadGameDetails()
    } catch (error) {
      console.error('Error leaving game:', error)
      alert('Erro ao sair do jogo. Tenta novamente.')
    }
  }

  const handleJoinAsSuplente = async () => {
    setJoining(true)
    setJoinError('')
    try {
      const { error } = await supabase
        .from('participants')
        .insert([{ game_id: id, user_id: user.id, status: 'waitlisted', joined_alone: true }])

      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error joining waitlist:', error)
      setJoinError('Não conseguimos inscrever-te como suplente. Tenta novamente.')
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveWaitlist = async () => {
    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('game_id', id)
        .eq('user_id', user.id)
        .eq('status', 'waitlisted')

      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error leaving waitlist:', error)
      alert('Erro ao sair da lista de suplentes. Tenta novamente.')
    }
  }
```

- [ ] **Step 7: Derive `waitlistPeople` and `isUserWaitlisted`**

Find:

```jsx
  const peopleCount = countPeople(participants)
  const capacity = game?.max_players || numCourts * 4
  const isUserJoined = participants.some(p => p.user_id === user.id || p.partner_id === user.id)
```

Replace with:

```jsx
  const peopleCount = countPeople(participants)
  const capacity = game?.max_players || numCourts * 4
  const isUserJoined = participants.some(p => p.user_id === user.id || p.partner_id === user.id)
  const waitlistPeople = waitlist.map(w => ({ ...w.user, rowOwner: true, rowId: w.id, hasPartner: false }))
  const isUserWaitlisted = waitlist.some(w => w.user_id === user.id)
```

- [ ] **Step 8: Add the "Suplentes" list section**

Find the end of the "Jogadores" card (right before the "Ações de inscrição" comment):

```jsx
            </div>
          )}
        </div>
      )}

      {/* Ações de inscrição */}
```

Replace with:

```jsx
            </div>
          )}
        </div>
      )}

      {/* Suplentes (lista de espera) */}
      {!mixStarted && waitlistPeople.length > 0 && (
        <div className="card">
          <h3 className="text-lg text-ink-900 mb-4">Suplentes</h3>
          <div className="space-y-2.5">
            {waitlistPeople.map((person, idx) => (
              <div
                key={`${person.id}-${idx}`}
                className={`rounded-ctrl p-3.5 flex items-center gap-3 ${
                  person.id === user.id ? 'bg-lime-400/20' : 'bg-canvas'
                }`}
              >
                <span className="w-6 text-center font-extrabold text-muted text-sm shrink-0">{idx + 1}º</span>
                <Avatar name={person.name} url={person.avatar_url} size="w-10 h-10 text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-ink-900 truncate">
                    {person.name}
                    {person.id === user.id && (
                      <span className="text-muted font-normal text-sm"> · tu</span>
                    )}
                  </p>
                </div>
                {person.is_guest
                  ? <GuestBadge label={person.is_test ? 'Teste' : 'Convidado'} />
                  : <LevelBadge level={person.level} />}
                {isAdmin && (
                  <button
                    onClick={() => handleRemovePerson(person)}
                    disabled={busy}
                    title={`Remover ${person.name}`}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-fast shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações de inscrição */}
```

- [ ] **Step 9: Add the "Entrar como suplente" and "Sair da lista de suplentes" buttons, and let admin's direct-add show when full**

Find:

```jsx
          {isAdmin && peopleCount < capacity && (
            <PrimaryButton
              variant="ghost"
              onClick={handleAddTestUser}
              disabled={addingTestUser}
              className="w-full"
            >
              <UserPlus size={20} />
              {addingTestUser ? 'A adicionar…' : 'Adicionar jogador de teste'}
            </PrimaryButton>
          )}

          {canJoin && !joinMode && (
            <>
              <PrimaryButton
                onClick={handleJoinAlone}
                disabled={joining}
                className="w-full"
              >
                <User size={20} />
                {joining ? 'A inscrever…' : 'Entrar sozinho'}
              </PrimaryButton>
              {/* Guests join alone only — the partner picker is a member list */}
              {!isGuest && peopleCount + 2 <= capacity && (
                <PrimaryButton
                  variant="ghost"
                  onClick={() => setJoinMode('partner')}
                  disabled={joining}
                  className="w-full"
                >
                  <UserPlus size={20} />
                  Entrar com parceiro
                </PrimaryButton>
              )}
            </>
          )}
```

Replace with:

```jsx
          {isAdmin && (
            <PrimaryButton
              variant="ghost"
              onClick={handleAddTestUser}
              disabled={addingTestUser}
              className="w-full"
            >
              <UserPlus size={20} />
              {addingTestUser
                ? 'A adicionar…'
                : peopleCount < capacity
                  ? 'Adicionar jogador de teste'
                  : 'Adicionar jogador de teste como suplente'}
            </PrimaryButton>
          )}

          {canJoin && !joinMode && (
            <>
              <PrimaryButton
                onClick={handleJoinAlone}
                disabled={joining}
                className="w-full"
              >
                <User size={20} />
                {joining ? 'A inscrever…' : 'Entrar sozinho'}
              </PrimaryButton>
              {/* Guests join alone only — the partner picker is a member list */}
              {!isGuest && peopleCount + 2 <= capacity && (
                <PrimaryButton
                  variant="ghost"
                  onClick={() => setJoinMode('partner')}
                  disabled={joining}
                  className="w-full"
                >
                  <UserPlus size={20} />
                  Entrar com parceiro
                </PrimaryButton>
              )}
            </>
          )}

          {isFull && !isUserJoined && !isUserWaitlisted && (
            <PrimaryButton
              variant="ghost"
              onClick={handleJoinAsSuplente}
              disabled={joining}
              className="w-full"
            >
              <UserPlus size={20} />
              {joining ? 'A inscrever…' : 'Entrar como suplente'}
            </PrimaryButton>
          )}
```

- [ ] **Step 10: Add the "Sair da lista de suplentes" button**

Find:

```jsx
          {isUserJoined && (game.status === 'open' || game.status === 'closed') && (
            <PrimaryButton variant="danger" onClick={handleLeaveGame} className="w-full">
              Sair do jogo
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  )
}
```

Replace with:

```jsx
          {isUserJoined && (game.status === 'open' || game.status === 'closed') && (
            <PrimaryButton variant="danger" onClick={handleLeaveGame} className="w-full">
              Sair do jogo
            </PrimaryButton>
          )}

          {isUserWaitlisted && (
            <PrimaryButton variant="danger" onClick={handleLeaveWaitlist} className="w-full">
              Sair da lista de suplentes
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 11: Run the build**

Run: `npx vite build`
Expected: build succeeds (exit code 0), no errors.

- [ ] **Step 12: Manual QA checklist (write this down, run it against a real mix in the browser)**

1. Open a mix that's not full — confirm no "Entrar como suplente" button shows, and the Suplentes section is absent.
2. Fill the mix to capacity (join with enough accounts, or as admin use "Adicionar jogador de teste" repeatedly). Confirm the normal join buttons disappear and "Entrar como suplente" appears.
3. Join as a suplente. Confirm: the button is replaced by "Sair da lista de suplentes"; a "Suplentes" section appears showing your name at position "1º".
4. Join a second account as a suplente. Confirm it appears at "2º", below the first.
5. As the first confirmed participant, leave the mix. Confirm: after the realtime refresh, the 1st suplente is now in the main "Jogadores" list (no longer in Suplentes), and the 2nd suplente moved up to "1º".
6. As admin, remove a suplente via the "X" button in the Suplentes section. Confirm it disappears from the list without affecting the confirmed roster or capacity.
7. Click "Sair da lista de suplentes" as a waitlisted user. Confirm you're removed and "Entrar como suplente" reappears for you.

- [ ] **Step 13: Commit**

```bash
git add src/pages/GameDetails.jsx
git commit -m "Add suplentes join/leave and waitlist UI to GameDetails"
```

---

## Task 3: WhatsApp bot — "mix cheio, queres entrar como suplente?" flow

**Files:**
- Modify: `whatsapp-bot/src/commands.js`
- Modify: `whatsapp-bot/src/messages.js`

**Interfaces:**
- Consumes: `participants.status = 'waitlisted'` (Task 1); `loadGame`, `getOpenMixes` from `roster.js` (unchanged, already imported).
- Produces: nothing new consumed by other tasks (Task 4 is independent — it reacts to the `participants` UPDATE this task's "Sim" path causes, via Realtime, not via a direct call).

- [ ] **Step 1: Add the pending-confirmation help text**

In `whatsapp-bot/src/messages.js`, find:

```js
Se houver mais do que um mix aberto ao mesmo tempo, o bot diz-te o código (🆔) de cada um — escreve o comando seguido do código, por exemplo:
• *In 1234*
• *Out 1234*

Para veres esta lista:
• */help*`
```

Replace with:

```js
Se houver mais do que um mix aberto ao mesmo tempo, o bot diz-te o código (🆔) de cada um — escreve o comando seguido do código, por exemplo:
• *In 1234*
• *Out 1234*

Se o mix estiver cheio, o bot pergunta se queres entrar como suplente — responde *Sim* ou *Não*. Quando alguém sair, o primeiro suplente entra automaticamente.

Para veres esta lista:
• */help*`
```

- [ ] **Step 2: Run a syntax check**

Run: `node --check whatsapp-bot/src/messages.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Replace `whatsapp-bot/src/commands.js` in full**

This file is small enough, and the control flow changes touch enough of it, that a full replacement is clearer than a series of patches. Replace the entire contents of `whatsapp-bot/src/commands.js` with:

```js
import { supabase } from './supabase.js'
import { getSettings } from './settings.js'
import { loadGame, getOpenMixes, formatDateTime } from './roster.js'
import { resolveProfileByPhoneJid } from './phone.js'
import { config } from './config.js'
import { HELP_TEXT, HELP_FOOTER } from './messages.js'

function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const IN_WORDS = ['in', 'dentro', 'estou dentro', 'to dentro', 'tou dentro', 'alinho']
const OUT_WORDS = ['out', 'fora', 'estou fora', 'saio']
const HELP_WORDS = ['/help', 'help', 'ajuda', '/ajuda']

const SUPLENTE_CONFIRM_TTL_MS = 10 * 60 * 1000

// Tracks "we asked sender X whether they want to join mix Y as a
// suplente" so their very next message is interpreted as that answer
// instead of a fresh command. In-memory only, keyed by sender+group —
// lost on bot restart, which is an acceptable trade-off since restarts
// are rare and the worst case is the person just retries "in".
const pendingSuplenteConfirmations = new Map()

function pendingKey(senderPn, groupJid) {
  return `${senderPn}:${groupJid}`
}

function getPendingConfirmation(senderPn, groupJid) {
  const key = pendingKey(senderPn, groupJid)
  const entry = pendingSuplenteConfirmations.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    pendingSuplenteConfirmations.delete(key)
    return null
  }
  return entry
}

/**
 * Parses one message into { action, code } or null (silently ignored —
 * covers all normal group chatter). `code`, when present, is a trailing
 * 4-digit mix code (e.g. "in 1234", "alinho 1234") used to pick a specific
 * mix when several are open at once; it's optional otherwise.
 */
function parseCommand(text) {
  const normalized = stripAccents(text.trim().toLowerCase())

  if (HELP_WORDS.includes(normalized)) return { action: 'help', code: null }
  if (IN_WORDS.includes(normalized)) return { action: 'in', code: null }
  if (OUT_WORDS.includes(normalized)) return { action: 'out', code: null }

  const match = normalized.match(/^(.+) (\d{4})$/)
  if (match) {
    const [, word, code] = match
    if (IN_WORDS.includes(word)) return { action: 'in', code }
    if (OUT_WORDS.includes(word)) return { action: 'out', code }
  }
  return null
}

const OPEN_STATUSES = new Set(['open', 'closed'])

function formatMixLine(mix) {
  const location = mix.location ? `, ${mix.location}` : ''
  return `🆔 *${mix.short_code}* — ${mix.title}, ${formatDateTime(mix.date)}${location}`
}

/**
 * Handles one incoming group message. First checks whether the sender has
 * a live "queres entrar como suplente?" question pending (see
 * `pendingSuplenteConfirmations`) — if so, this message is treated as the
 * Sim/Não answer, not a fresh command. Otherwise, only acts on exact
 * "in"/"out"/"help" text, optionally followed by a 4-digit mix code (see
 * parseCommand); everything else — including all normal group chatter —
 * is silently ignored.
 *
 * Successful joins/leaves don't get an explicit reply here: they write to
 * `participants`, which sync.js's Realtime subscription picks up and turns
 * into a fresh roster repost for that specific mix — that repost IS the
 * confirmation, matching the reference bot's behavior. Only rejections and
 * disambiguation prompts reply directly.
 */
export async function handleGroupMessage({ groupJid, senderPn, text, message }, { sendText }) {
  const settings = await getSettings()
  if (!settings.whatsapp_group_jid || groupJid !== settings.whatsapp_group_jid) return

  // Quote the sender's own message so a reply is unambiguous even when
  // several people send commands close together. Every reply also points
  // back to /help, except the help listing itself.
  const reply = (msg) => sendText(groupJid, `${msg}${HELP_FOOTER}`, { quoted: message })

  async function resolveProfileOrReply() {
    const profile = await resolveProfileByPhoneJid(senderPn)
    if (!profile) {
      await reply(
        `🤖 Não te encontrei na app 😅 Regista-te primeiro em ${config.appUrl} e confirma o teu número de telemóvel no perfil.`
      )
    }
    return profile
  }

  const pending = getPendingConfirmation(senderPn, groupJid)
  if (pending) {
    const normalized = stripAccents(text.trim().toLowerCase())
    const key = pendingKey(senderPn, groupJid)

    if (normalized === 'sim') {
      pendingSuplenteConfirmations.delete(key)

      const { game } = await loadGame(pending.gameId)
      const gameIsFuture = new Date(game.date).getTime() > Date.now()
      if (!OPEN_STATUSES.has(game.status) || !gameIsFuture) {
        await reply('🤖 Este mix já não está disponível para inscrições.')
        return
      }

      const profile = await resolveProfileOrReply()
      if (!profile) return

      const { error: insertError } = await supabase
        .from('participants')
        .insert([{ game_id: pending.gameId, user_id: profile.id, status: 'waitlisted', joined_alone: true }])

      if (insertError && insertError.code !== '23505') {
        throw new Error(`Failed to insert waitlisted participant: ${insertError.message}`)
      }
      // No reply — the participants INSERT triggers a roster repost via sync.js.
      return
    }

    if (normalized === 'nao') {
      pendingSuplenteConfirmations.delete(key)
      return
    }

    if (!pending.reprompted) {
      pending.reprompted = true
      await reply('🤖 Não percebi 🤔 Responde só com *Sim* ou *Não*.')
      return
    }
    // Already reprompted once for this pending question — stop nagging
    // and fall through to normal command parsing below (this might be a
    // genuine command, not a stray reply).
  }

  const parsed = parseCommand(text)
  if (!parsed) return
  const { action, code } = parsed

  if (action === 'help') {
    await sendText(groupJid, HELP_TEXT, { quoted: message })
    return
  }

  const openMixes = await getOpenMixes()
  if (openMixes.length === 0) {
    await reply('🤖 Não há nenhum mix com inscrições abertas neste momento.')
    return
  }

  // Joins/leaves a specific, already-resolved mix — the same logic
  // regardless of how that mix got picked (explicit code, the only-one-open
  // shortcut, or being the one mix the sender is in for a bare "out").
  async function actOnGame(mixRow, knownProfile) {
    const { game, people, capacity } = await loadGame(mixRow.id)
    const gameIsFuture = new Date(game.date).getTime() > Date.now()

    if (!OPEN_STATUSES.has(game.status) || !gameIsFuture) {
      if (action === 'in') {
        await reply('🤖 Não há nenhum mix com inscrições abertas neste momento.')
      } else {
        await reply('🤖 Este mix já começou/terminou — já não é possível sair por aqui.')
      }
      return
    }

    const profile = knownProfile ?? (await resolveProfileOrReply())
    if (!profile) return

    const { data: existingRows, error: existingError } = await supabase
      .from('participants')
      .select('id, user_id, partner_id, status')
      .eq('game_id', game.id)
      .in('status', ['confirmed', 'waitlisted'])

    if (existingError) throw new Error(`Failed to check existing participants: ${existingError.message}`)

    const ownConfirmedRow = existingRows.find((row) => row.user_id === profile.id && row.status === 'confirmed')
    const ownWaitlistRow = existingRows.find((row) => row.user_id === profile.id && row.status === 'waitlisted')
    const asPartnerRow = existingRows.find((row) => row.partner_id === profile.id)

    if (action === 'in') {
      if (ownConfirmedRow || asPartnerRow) {
        await reply('🤖 Já estás inscrito neste mix! 🎾')
        return
      }
      if (ownWaitlistRow) {
        await reply('🤖 Já estás na lista de suplentes deste mix! 🎾')
        return
      }
      if (people.length >= capacity) {
        pendingSuplenteConfirmations.set(pendingKey(senderPn, groupJid), {
          gameId: game.id,
          expiresAt: Date.now() + SUPLENTE_CONFIRM_TTL_MS,
          reprompted: false,
        })
        await reply('🤖 Mix cheio! Queres entrar como suplente? Responde com *Sim* ou *Não*.')
        return
      }

      const { error: insertError } = await supabase
        .from('participants')
        .insert([{ game_id: game.id, user_id: profile.id, status: 'confirmed', joined_alone: true }])

      if (insertError) {
        if (insertError.code === '23505') {
          await reply('🤖 Já estás inscrito neste mix! 🎾')
          return
        }
        throw new Error(`Failed to insert participant: ${insertError.message}`)
      }
      // No reply — the participants INSERT triggers a roster repost via sync.js.
      return
    }

    // action === 'out'
    if (asPartnerRow) {
      await reply('🤖 Inscreveste-te em dupla pela app — para sair, usa a app 📱')
      return
    }
    if (!ownConfirmedRow) {
      await reply('🤖 Não estás inscrito neste mix.')
      return
    }

    const { error: deleteError } = await supabase.from('participants').delete().eq('id', ownConfirmedRow.id)
    if (deleteError) throw new Error(`Failed to remove participant: ${deleteError.message}`)
    // No reply — the participants DELETE triggers a roster repost via sync.js.
  }

  if (code) {
    const game = openMixes.find((m) => m.short_code === code)
    if (!game) {
      await reply(`🤖 Não encontrei nenhum mix aberto com o código ${code}.`)
      return
    }
    await actOnGame(game, null)
    return
  }

  if (openMixes.length === 1) {
    await actOnGame(openMixes[0], null)
    return
  }

  // 2+ open mixes, no code given — disambiguate.
  if (action === 'in') {
    const list = openMixes.map(formatMixLine).join('\n')
    await reply(
      `🤖 Há vários mixes abertos! Qual deles?\n\n${list}\n\nEscreve *In ${openMixes[0].short_code}* (com o código do mix que queres).`
    )
    return
  }

  // action === 'out': resolve the sender first so an unknown sender still
  // gets the existing rejection instead of a confusing "which mix?" prompt.
  const profile = await resolveProfileOrReply()
  if (!profile) return

  const { data: rows, error } = await supabase
    .from('participants')
    .select('game_id, user_id, partner_id')
    .in('game_id', openMixes.map((m) => m.id))
    .eq('status', 'confirmed')

  if (error) throw new Error(`Failed to check existing participants: ${error.message}`)

  const memberGameIds = new Set(
    rows.filter((row) => row.user_id === profile.id || row.partner_id === profile.id).map((row) => row.game_id)
  )
  const memberMixes = openMixes.filter((m) => memberGameIds.has(m.id))

  if (memberMixes.length === 0) {
    await reply('🤖 Não estás inscrito em nenhum mix aberto.')
    return
  }
  if (memberMixes.length > 1) {
    const list = memberMixes.map(formatMixLine).join('\n')
    await reply(
      `🤖 Estás inscrito em vários mixes! De qual queres sair?\n\n${list}\n\nEscreve *Out ${memberMixes[0].short_code}* (com o código do mix).`
    )
    return
  }

  await actOnGame(memberMixes[0], profile)
}
```

- [ ] **Step 4: Run a syntax check**

Run: `node --check whatsapp-bot/src/commands.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual QA checklist (write this down, run it against the real bot + WhatsApp group when deployed)**

1. Fill a mix to capacity. Send "in" (or "alinho") from an account with no pending confirmation. Confirm the bot replies "🤖 Mix cheio! Queres entrar como suplente? Responde com *Sim* ou *Não*."
2. Reply "Sim". Confirm: no direct reply, but the group roster reposts showing you in the "Suplentes" section (once Task 4 ships) or otherwise unchanged in the numbered slots (before Task 4).
3. Send "in" again from the same account for the same full mix. Confirm the bot replies "🤖 Já estás na lista de suplentes deste mix! 🎾" (not another suplente prompt).
4. From a different full mix, reply with something ambiguous like "talvez" after being asked. Confirm one re-prompt ("Não percebi 🤔 …"), then send another ambiguous message — confirm no second re-prompt (silently ignored / falls through).
5. Trigger the prompt, then reply "Não". Confirm no reply and no participants row was inserted (check the app or `SUPABASE.../participants`).
6. With someone on the waitlist, have a confirmed participant leave via "out". Confirm the waitlisted person is promoted (once Task 1's migration is applied in Supabase) — check they now appear in the numbered roster slots on the next repost.

- [ ] **Step 6: Commit**

```bash
git add whatsapp-bot/src/commands.js whatsapp-bot/src/messages.js
git commit -m "Add suplente Sim/Nao confirmation flow to WhatsApp bot"
```

---

## Task 4: WhatsApp bot — promotion callout in roster repost

**Files:**
- Modify: `whatsapp-bot/src/roster.js`
- Modify: `whatsapp-bot/src/sync.js`

**Interfaces:**
- Consumes: `participants` UPDATE events with `old.status = 'waitlisted'` and `new.status = 'confirmed'` (only observable because `participants` already has `REPLICA IDENTITY FULL`, set in `migration_whatsapp_bot.sql` — old row values are included in the Realtime payload).
- Produces: `buildCombinedRosterMessage(mixStates, { promotedNames })` — the `{ promotedNames }` second argument is new and optional (defaults to `[]`); no other task calls this function, so this is a non-breaking signature change.

- [ ] **Step 1: Accept and render `promotedNames` in `buildCombinedRosterMessage`**

In `whatsapp-bot/src/roster.js`, find:

```js
export function buildCombinedRosterMessage(mixStates) {
  if (mixStates.length === 0) return null

  const showCode = mixStates.length > 1
  const header = showCode ? `📋 *Mixes abertos (${mixStates.length})*\n\n` : ''
  const blocks = mixStates.map((state) => buildMixBlock(state, { showCode })).join(MIX_SEPARATOR)

  return header + blocks + HELP_FOOTER
}
```

Replace with:

```js
export function buildCombinedRosterMessage(mixStates, { promotedNames = [] } = {}) {
  if (mixStates.length === 0) return null

  const showCode = mixStates.length > 1
  const promoBlock = promotedNames.length > 0
    ? `${promotedNames.map((name) => `🎉 ${firstNameLastInitial(name)} subiu da lista de suplentes!`).join('\n')}\n\n`
    : ''
  const header = showCode ? `📋 *Mixes abertos (${mixStates.length})*\n\n` : ''
  const blocks = mixStates.map((state) => buildMixBlock(state, { showCode })).join(MIX_SEPARATOR)

  return promoBlock + header + blocks + HELP_FOOTER
}
```

- [ ] **Step 2: Run a syntax check**

Run: `node --check whatsapp-bot/src/roster.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Detect promotions in `sync.js`'s participants listener and thread `promotedNames` through the debounce**

In `whatsapp-bot/src/sync.js`, find:

```js
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
```

Replace with:

```js
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
```

- [ ] **Step 4: Thread `promotedNames` through `postCombinedRoster` and `scheduleRepost`**

Find:

```js
async function postCombinedRoster(sendText, getGroupMentions, { tagAll = false } = {}) {
  const settings = await getSettings()
  if (!settings.whatsapp_group_jid) return

  const openMixes = await getOpenMixes()
  const mixStates = await Promise.all(openMixes.map((mix) => loadGame(mix.id)))
  const text = buildCombinedRosterMessage(mixStates)
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

function scheduleRepost(sendText, getGroupMentions, { tagAll = false } = {}) {
  pendingTagAll = pendingTagAll || tagAll
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const shouldTagAll = pendingTagAll
    pendingTagAll = false
    postCombinedRoster(sendText, getGroupMentions, { tagAll: shouldTagAll }).catch((err) =>
      console.error('Failed to repost combined roster:', err)
    )
  }, DEBOUNCE_MS)
}
```

Replace with:

```js
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
```

- [ ] **Step 5: Detect a promotion in the participants Realtime handler**

Find:

```js
  supabase
    .channel('whatsapp-bot-participants')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
      // Always recomputed fresh from the DB at post time, and the hash
      // check above skips a no-op send — no need to pre-filter which
      // mix this row belongs to. Someone joining/leaving isn't a
      // create/edit, so this never tags @all.
      scheduleRepost(sendText, getGroupMentions)
    })
    .subscribe()
```

Replace with:

```js
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
```

- [ ] **Step 6: Run a syntax check**

Run: `node --check whatsapp-bot/src/sync.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Manual QA checklist (write this down, run it against the real bot when deployed, after Task 1's migration is applied)**

1. With someone waitlisted on a full mix, have a confirmed participant leave. Confirm the next roster repost starts with "🎉 <Name> subiu da lista de suplentes!" above the mix listing.
2. Confirm a normal join/leave (no promotion involved) still reposts the roster with no callout line.
3. Confirm a brand-new mix creation still tags @all as before (this task didn't touch that path, but verify no regression).

- [ ] **Step 8: Commit**

```bash
git add whatsapp-bot/src/roster.js whatsapp-bot/src/sync.js
git commit -m "Add promotion callout to WhatsApp bot roster repost"
```
