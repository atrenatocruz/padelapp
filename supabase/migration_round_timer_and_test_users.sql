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
