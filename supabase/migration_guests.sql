-- ════════════════════════════════════════════════════════════════════════
-- Migration: Guest access ("Entrar como convidado")
-- Run this whole file in Supabase → SQL Editor → New query → Run.
--
-- Dashboard setting required (cannot be done via SQL):
--   Authentication → Sign In / Providers → User Signups
--   → toggle "Allow anonymous sign-ins" ON → Save changes
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. is_guest column ─────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Profile auto-creation trigger ───────────────────────────────────
-- Anonymous users have email = NULL, which crashed the old trigger
-- (email column is NOT NULL). Also stamps is_guest from auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, birthday, gender, phone, level, is_admin, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Utilizador'),
    COALESCE(NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'gender', NULL),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    'iniciante',
    FALSE,
    COALESCE(NEW.is_anonymous, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Stats: guests never count ───────────────────────────────────────
-- Rewritten as a loop with an is_guest guard per player. Guests play,
-- but never get a player_stats row, so they can't leak into rankings.
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      (NEW.team1_player1_id, NEW.team1_score, NEW.team2_score),
      (NEW.team1_player2_id, NEW.team1_score, NEW.team2_score),
      (NEW.team2_player1_id, NEW.team2_score, NEW.team1_score),
      (NEW.team2_player2_id, NEW.team2_score, NEW.team1_score)
    ) AS t(player_id, scored, conceded)
  LOOP
    IF p.player_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = p.player_id AND is_guest
    ) THEN
      INSERT INTO player_stats (user_id, games_played, games_won, total_points_scored, total_points_conceded)
      VALUES (
        p.player_id, 1,
        CASE WHEN p.scored > p.conceded THEN 1 ELSE 0 END,
        p.scored, p.conceded
      )
      ON CONFLICT (user_id) DO UPDATE
      SET games_played = player_stats.games_played + 1,
          games_won = player_stats.games_won + CASE WHEN p.scored > p.conceded THEN 1 ELSE 0 END,
          total_points_scored = player_stats.total_points_scored + p.scored,
          total_points_conceded = player_stats.total_points_conceded + p.conceded,
          updated_at = NOW();
    END IF;
  END LOOP;

  -- Mark game as completed
  UPDATE games SET status = 'completed', updated_at = NOW()
  WHERE id = NEW.game_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 4. RLS policies ─────────────────────────────────────────────────────

-- FIX (pre-existing bug): participants had NO DELETE policy, so
-- "Sair do jogo" silently failed for everyone. Players (incl. guests)
-- can now remove their own participation.
DROP POLICY IF EXISTS "Users can leave games" ON participants;
CREATE POLICY "Users can leave games"
  ON participants FOR DELETE
  USING (auth.uid() = user_id);

-- Ranking data: hidden from guests and from unauthenticated clients.
DROP POLICY IF EXISTS "Stats are viewable by everyone" ON player_stats;
DROP POLICY IF EXISTS "Stats viewable by registered users" ON player_stats;
CREATE POLICY "Stats viewable by registered users"
  ON player_stats FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) = FALSE
  );

-- Results: guests cannot submit (they participate; regulars submit).
DROP POLICY IF EXISTS "Participants and admins can submit results" ON results;
CREATE POLICY "Participants and admins can submit results"
  ON results FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) = FALSE
    AND (
      EXISTS (
        SELECT 1 FROM participants
        WHERE participants.game_id = game_id AND participants.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
      )
    )
  );

-- NOTE (deliberate): profiles SELECT stays public. Guest names must render
-- inside game participant lists for everyone, and regular players' names
-- must render for guests. The app filters is_guest=false everywhere a
-- global player list / ranking is shown.
