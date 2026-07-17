# Multi-tenant redesign (Phase 1: data model + RLS)

## Context

padel.app (internally "Alinho") is pivoting from a single club (Os Padeleiros) to a multi-tenant SaaS with real clients (2-5 now, manual onboarding). This is decided:

- **Shared Supabase project/schema**, tenant boundary = `organization_id`, not one database per client — because a player must be able to belong to more than one club at once (real requirement, not hypothetical), which a database-per-tenant model can't support with a single login/profile.
- **No data migration** — current data is test data; this is a clean-slate rebuild (drop and recreate), not a backfill of Os Padeleiros into "Organization #1."
- Each client still gets its own WhatsApp bot **process** (own WhatsApp number/session), but that process now needs to know which `organization_id` it serves.
- Phone numbers are never stored in plaintext anywhere in Supabase — only an HMAC-SHA256 hash, computed outside Supabase, with a secret that never touches Supabase's storage layer (not even Vault).

This spec covers the data model and RLS. Hashing's *mechanism* (where the secret lives, the hashing endpoint) is included because it changes what `profiles.phone` becomes, but the full hashing implementation is Phase 2.

## Schema

### `organizations` (new — replaces the old singular `settings` table)
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- used in signup links, e.g. padel.app/entrar?org=os-padeleiros
  whatsapp_group_jid TEXT,
  robot_contact TEXT,
  group_logo_url TEXT,
  points_rules JSONB NOT NULL DEFAULT '{"point_per_match_played":1,"point_per_match_win":3,"point_per_mix_participation":2,"point_per_mix_win":10}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
```

### `profiles` (reworked — pure identity, no per-club fields)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,               -- nickname; doesn't have to be the real name
  email TEXT NOT NULL,
  birthday DATE,
  gender TEXT,
  phone_hash TEXT,                  -- HMAC-SHA256, hex. Never plaintext. Global secret (see Phase 2) so the same person hashes identically across every org/bot.
  preferred_side TEXT NOT NULL DEFAULT 'both' CHECK (preferred_side IN ('left','right','both')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);
```
`is_admin`, `is_guest`, `level` move to `memberships` — they're per-club, not per-person. **Assumption to confirm:** I put `level` (skill tier) per-membership, not global — a club might reasonably assess/label someone's level independently of another club. If you want one global skill level across all clubs instead, say so, it's a one-column move.

### `memberships` (new — the actual tenant boundary for people)
```sql
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  level TEXT DEFAULT 'iniciante',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, organization_id)
);
```

### `games` — gains `organization_id`, required from day one (no backfill needed, clean slate)
```sql
ALTER TABLE games ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
```

### Child tables (`participants`, `results`, `teams`, `matches`)
**No `organization_id` column added directly** — scoped via `games.organization_id` through a JOIN in their RLS policies. One source of truth (games), no risk of a denormalized copy drifting out of sync. Trade-off: policies are a join instead of a flat equality check — acceptable at this scale, revisit only if it ever shows up as a real query-performance problem.

### `player_stats`, `mix_player_stats` — gain `organization_id` directly (these ARE inherently per-club — a rating at Club A must not blend with Club B)
```sql
ALTER TABLE player_stats ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
-- unique key becomes (user_id, organization_id) instead of just user_id
```

## RLS pattern

Every org-scoped table follows one of two shapes:

**Direct** (table has `organization_id` itself — `games`, `player_stats`, `mix_player_stats`):
```sql
USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.organization_id = games.organization_id AND memberships.user_id = auth.uid()))
```

**Cascaded through games** (`participants`, `results`, `teams`, `matches`):
```sql
USING (EXISTS (
  SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
  WHERE games.id = participants.game_id AND memberships.user_id = auth.uid()
))
```

Admin-only writes (create game, manage members, etc.) add `AND memberships.is_admin = TRUE` to the same shape.

**`profiles` SELECT** — no longer "any authenticated user," now "yourself, or someone who shares an org with you" (this also fully closes the PII item deferred from the earlier security review — you literally cannot query a stranger's profile anymore, not just "the UI doesn't show it"):
```sql
USING (
  id = auth.uid() OR
  EXISTS (SELECT 1 FROM memberships m1 JOIN memberships m2 ON m1.organization_id = m2.organization_id
          WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id)
)
```

**`memberships` SELECT** — see your own rows, or every row in an org where you're admin (for member management). This is a table whose policy queries itself — works fine in Postgres RLS, but flagging it for extra attention during testing since it's a less common pattern than the rest.

## RPCs — every admin-guarded function needs an org-scope argument

- `admin_delete_user` → **splits into two**, because "remove someone" now has two different meanings:
  - `admin_remove_member(p_organization_id, p_user_id)` — removes their `membership` in that org only. They keep their account and any other clubs they belong to. This is what an org admin can do.
  - `delete_my_account()` — self-service, no admin required, deletes the caller's own identity entirely (cascades all memberships). This is the actual GDPR right-to-erasure path, and per our earlier privacy conversation, it should probably be self-service rather than "ask an admin," now that this is a real product with paying clients.
- `admin_set_admin` → becomes `admin_set_membership_admin(p_organization_id, p_user_id, p_is_admin)`, guard checks "is caller admin of THIS org."
- `finalize_mix` → guard changes from global `is_admin` to "is caller admin of this game's org" (join through `games.organization_id`).

## Bot changes (mechanism only — full Phase 2 scope covers the rest)

- New required env var `ORGANIZATION_ID` per bot deployment — every query gets scoped to it (`organizations` row lookup replaces today's singular `getSettings()`).
- Phone hashing secret is **global**, shared across every bot deployment and the hashing endpoint below — not per-org — otherwise the same person hashes differently at different clubs and cross-club identity breaks.
- **Design refinement over what was discussed in chat:** rather than each per-client bot independently implementing HMAC (risk of subtle drift between deployments breaking cross-club matching), centralize phone hashing in **one shared service** — most naturally a Supabase Edge Function with its own function-level secret (separate from Postgres/Vault, satisfying "the secret never touches the DB layer"). Every bot and every web app instance calls the same function. One implementation, no drift risk.

## Frontend implications (not full Phase 3 scope, but Phase 1 can't ship without a minimal version)

- Signup needs to know which org it's for — proposing a `slug` per organization and signup links like `padel.app/entrar?org=os-padeleiros`, since manual onboarding means you're handing each client a link anyway.
- `AuthContext` needs a `memberships` list + a "current organization" concept (defaults to the only one if there's just one, needs a switcher once someone has 2+).
- Every existing query (Home, GameDetails, Rankings, Admin) needs to filter by the current org — RLS stops a *leak*, but the app still needs to know which org's data to *ask for*.

## Open questions before writing the implementation plan

1. `level` per-membership vs. global on `profiles` (see above) — confirm or correct.
2. Does `delete_my_account()` (self-service full deletion) belong in this phase, or is "ask an admin to remove me from a club" enough for now, with true self-service deletion as a later privacy-focused pass?
3. Org signup via `?org=slug` link — good enough for 2-5 manually-onboarded clients, or do you want something else (e.g., an invite-code system)?
4. Confirm: **wipe the current Supabase project's data now** (not create a new project) — this is the destructive step, only doing it on explicit go-ahead.
