-- ════════════════════════════════════════════════════════════════════════
-- Migration: Mix engine (courts, duplas, rondas, formatos, ranking)
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- No dashboard toggles needed for this migration.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. profiles: preferred side (used by dupla formation) ───────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_side TEXT NOT NULL DEFAULT 'both'
  CHECK (preferred_side IN ('left', 'right', 'both'));

-- ── 2. player_stats: mix ranking counters ────────────────────────────────
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS game_wins   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS game_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS mix_wins    INTEGER NOT NULL DEFAULT 0;

-- ── 3. games: mix configuration ──────────────────────────────────────────
-- max_players is kept but becomes DERIVED (num_courts × 4), written by the app.
ALTER TABLE games ADD COLUMN IF NOT EXISTS num_courts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN IF NOT EXISTS court_time_minutes INTEGER NOT NULL DEFAULT 90;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_time_minutes INTEGER NOT NULL DEFAULT 20;
ALTER TABLE games ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'sobe_desce'
  CHECK (format IN ('sobe_desce', 'todos_contra_todos'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS winner_team_id UUID;
-- status now also uses: 'in_progress', 'finished' (no constraint existed; none added)

-- ── 4. teams (duplas) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES profiles(id),
  player2_id UUID NOT NULL REFERENCES profiles(id),
  seed_ranking DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ── 5. matches (jogos sorteados dentro do mix) ───────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  court_number INTEGER NOT NULL,
  team_a_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  score_a INTEGER,
  score_b INTEGER,
  phase TEXT NOT NULL DEFAULT 'group' CHECK (phase IN ('group', 'quarter', 'semi', 'final')),
  winner_team_id UUID REFERENCES teams(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ── 6. RLS: everyone reads, only admins write ────────────────────────────
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams viewable by everyone" ON teams;
CREATE POLICY "Teams viewable by everyone" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage teams" ON teams;
CREATE POLICY "Admins manage teams" ON teams
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

DROP POLICY IF EXISTS "Matches viewable by everyone" ON matches;
CREATE POLICY "Matches viewable by everyone" ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage matches" ON matches;
CREATE POLICY "Admins manage matches" ON matches
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- ── 7. Auto-close: count PEOPLE (partner rows = 2) against max_players ───
-- Replaces the old hardcoded ">= 4". Only closes games that are still open.
CREATE OR REPLACE FUNCTION check_game_full()
RETURNS TRIGGER AS $$
DECLARE
  people INTEGER;
  cap INTEGER;
BEGIN
  SELECT COALESCE(SUM(1 + CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END), 0)
    INTO people
    FROM participants
   WHERE game_id = NEW.game_id AND status = 'confirmed';

  SELECT COALESCE(max_players, num_courts * 4) INTO cap FROM games WHERE id = NEW.game_id;

  IF people >= cap THEN
    UPDATE games SET status = 'closed', updated_at = NOW()
    WHERE id = NEW.game_id AND status = 'open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 7b. Reopen a closed (not started) game when someone leaves ───────────
-- SECURITY DEFINER: the leaving player can't update games under RLS.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS game_reopen_trigger ON participants;
CREATE TRIGGER game_reopen_trigger
AFTER DELETE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_reopen();

-- ── 8. Finalize RPC (transactional ranking update) ───────────────────────
-- Decision documented: ranking math runs in ONE transaction here, not in the
-- app, so a mid-update failure can never leave the ranking half-applied.
-- Guests never accrue game_wins/game_losses/mix_wins (filtered by is_guest).
CREATE OR REPLACE FUNCTION finalize_mix(p_game_id UUID, p_winner_team_id UUID)
RETURNS void AS $$
BEGIN
  -- admin only
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem finalizar um mix';
  END IF;

  -- must be in progress (prevents double-finalize)
  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND status = 'in_progress') THEN
    RAISE EXCEPTION 'O mix não está a decorrer';
  END IF;

  -- every match must have a result
  IF EXISTS (SELECT 1 FROM matches WHERE game_id = p_game_id AND winner_team_id IS NULL) THEN
    RAISE EXCEPTION 'Há jogos sem resultado registado';
  END IF;

  -- winner team must belong to this game
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_winner_team_id AND game_id = p_game_id) THEN
    RAISE EXCEPTION 'Dupla vencedora inválida';
  END IF;

  -- per-player game wins/losses from every decided match + mix win for the
  -- winning dupla — guests excluded from all of it
  WITH mt AS (
    SELECT m.winner_team_id AS win_id, t.id AS team_id, t.player1_id, t.player2_id
    FROM matches m
    JOIN teams t ON t.id = m.team_a_id OR t.id = m.team_b_id
    WHERE m.game_id = p_game_id
  ),
  pp AS (
    SELECT unnest(ARRAY[player1_id, player2_id]) AS pid,
           (team_id = win_id) AS won
    FROM mt
  ),
  agg AS (
    SELECT pid,
           COUNT(*) FILTER (WHERE won) AS wins,
           COUNT(*) FILTER (WHERE NOT won) AS losses
    FROM pp
    WHERE pid IS NOT NULL
    GROUP BY pid
  )
  INSERT INTO player_stats (user_id, game_wins, game_losses, mix_wins)
  SELECT a.pid, a.wins, a.losses,
         CASE WHEN a.pid IN (
           SELECT unnest(ARRAY[player1_id, player2_id]) FROM teams WHERE id = p_winner_team_id
         ) THEN 1 ELSE 0 END
  FROM agg a
  JOIN profiles pr ON pr.id = a.pid AND pr.is_guest = FALSE
  ON CONFLICT (user_id) DO UPDATE
  SET game_wins   = player_stats.game_wins   + EXCLUDED.game_wins,
      game_losses = player_stats.game_losses + EXCLUDED.game_losses,
      mix_wins    = player_stats.mix_wins    + EXCLUDED.mix_wins,
      updated_at  = NOW();

  UPDATE games
  SET status = 'finished', winner_team_id = p_winner_team_id, updated_at = NOW()
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION finalize_mix(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION finalize_mix(UUID, UUID) TO authenticated;
