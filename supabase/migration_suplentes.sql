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
