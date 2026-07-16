-- ════════════════════════════════════════════════════════════════════════
-- Migration: 4-digit short codes for mixes (supports multiple concurrent
-- open mixes over WhatsApp — see whatsapp-bot/).
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. games: permanent, never-reused 4-digit code ───────────────────────
ALTER TABLE games ADD COLUMN IF NOT EXISTS short_code CHAR(4);

DO $$
BEGIN
  ALTER TABLE games ADD CONSTRAINT games_short_code_format CHECK (short_code ~ '^[0-9]{4}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS games_short_code_key ON games(short_code);

-- ── 2. Auto-generate on insert, retry on collision ───────────────────────
-- Deliberately simple: at ~9000 possible codes and a handful of mixes
-- created per week, this isn't built to survive high-concurrency races —
-- the UNIQUE INDEX is the real safety net. If two inserts ever did pick
-- the same candidate at the same instant, the losing insert fails with a
-- 23505 error, which surfaces through Admin.jsx's existing try/catch as
-- an alert; the admin just retries. Not worth more complexity than that.
CREATE OR REPLACE FUNCTION assign_game_short_code()
RETURNS TRIGGER AS $$
DECLARE
  attempt INTEGER := 0;
  candidate TEXT;
BEGIN
  IF NEW.short_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  LOOP
    attempt := attempt + 1;
    candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM games WHERE short_code = candidate) THEN
      NEW.short_code := candidate;
      RETURN NEW;
    END IF;
    IF attempt >= 20 THEN
      RAISE EXCEPTION 'Could not generate a unique short_code after % attempts', attempt;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_game_short_code_trigger ON games;
CREATE TRIGGER assign_game_short_code_trigger
BEFORE INSERT ON games
FOR EACH ROW EXECUTE FUNCTION assign_game_short_code();

-- ── 3. Backfill existing rows (trigger only fires on INSERT) ────────────
DO $$
DECLARE
  r RECORD;
  attempt INTEGER;
  candidate TEXT;
  done BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM games WHERE short_code IS NULL LOOP
    attempt := 0;
    done := FALSE;
    WHILE NOT done LOOP
      attempt := attempt + 1;
      candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
      IF NOT EXISTS (SELECT 1 FROM games WHERE short_code = candidate) THEN
        UPDATE games SET short_code = candidate WHERE id = r.id;
        done := TRUE;
      ELSIF attempt >= 20 THEN
        RAISE EXCEPTION 'Could not backfill short_code for game % after % attempts', r.id, attempt;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── 4. Safe to require going forward ──────────────────────────────────────
ALTER TABLE games ALTER COLUMN short_code SET NOT NULL;

-- ── 5. Drop the now-obsolete single-active-mix pointer ───────────────────
-- Multiple mixes can be open at once now; "which mixes are open" is
-- computed directly (status + date) instead of tracked via one pointer.
ALTER TABLE settings DROP COLUMN IF EXISTS active_whatsapp_game_id;
