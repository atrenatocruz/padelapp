-- ════════════════════════════════════════════════════════════════════════
-- Migration: WhatsApp group bot (settings, dedupe, realtime)
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. settings: target group + which mix bare "In"/"Out" refers to ──────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS whatsapp_group_jid TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS active_whatsapp_game_id UUID REFERENCES games(id) ON DELETE SET NULL;

-- ── 2. participants: prevent double-booking (also hardens the app's own
--      join flow against double-taps) ─────────────────────────────────────
-- Preflight check — run this first if you're unsure the table is clean:
--   SELECT game_id, user_id, COUNT(*) FROM participants
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
-- If that returns rows, dedupe them before running the CREATE UNIQUE INDEX
-- below (it will fail on existing duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS participants_game_user_key
  ON participants(game_id, user_id);

-- ── 3. participants: DELETE events must carry game_id for the bot's
--      realtime filter to work (default replica identity only includes
--      the primary key on DELETE) ──────────────────────────────────────────
ALTER TABLE participants REPLICA IDENTITY FULL;

-- ── 4. Enable realtime broadcast for the tables the bot subscribes to ────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE participants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE games;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 5. Optional data cleanup (NOT run automatically — review first) ─────
-- profiles.phone is free-form text; the bot matches WhatsApp senders by
-- normalizing to digits-only and comparing the last 9 digits, but messy
-- data (missing numbers, wrong country code, typos) will cause
-- unmatched-sender replies. Suggested one-time cleanup after eyeballing
-- the data:
--   UPDATE profiles SET phone = regexp_replace(phone, '\D', '', 'g')
--   WHERE phone IS NOT NULL;
