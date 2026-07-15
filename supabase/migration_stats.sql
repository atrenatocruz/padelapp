-- ════════════════════════════════════════════════════════════════════════
-- Migration: Mix statistics system — overall, monthly, per-mix, head-to-head
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Configurable points system ─────────────────────────────────────────
-- Lives in settings so admins can tune it without a redeploy. finalize_mix()
-- reads it at finalize time and stores the RESULT on mix_player_stats — so
-- changing the rules later only affects future mixes, never rewrites history.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_rules JSONB NOT NULL DEFAULT
  '{"point_per_match_played": 1, "point_per_match_win": 3, "point_per_mix_participation": 2, "point_per_mix_win": 10}'::jsonb;

-- ── 2. player_stats: lifetime totals the stats system needs ──────────────
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS mixes_played INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0;

-- ── 3. mix_player_stats: durable per-player snapshot of each finished mix ─
-- One row per (game, player), written once by finalize_mix(). This is what
-- powers the per-mix leaderboard and the monthly breakdown (grouped by the
-- mix's game.date client-side — no separate monthly table needed).
CREATE TABLE IF NOT EXISTS mix_player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  mix_won BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (game_id, user_id)
);

ALTER TABLE mix_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mix player stats viewable by registered users" ON mix_player_stats;
CREATE POLICY "Mix player stats viewable by registered users"
  ON mix_player_stats FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) = FALSE
  );
-- No INSERT/UPDATE policy: writes only ever happen inside finalize_mix()
-- (SECURITY DEFINER), same pattern already used for player_stats.

-- ── 4. finalize_mix(): now also snapshots per-player mix stats + points ──
CREATE OR REPLACE FUNCTION finalize_mix(p_game_id UUID, p_winner_team_id UUID)
RETURNS void AS $$
DECLARE
  rules JSONB;
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

  SELECT points_rules INTO rules FROM settings LIMIT 1;
  IF rules IS NULL THEN
    rules := '{"point_per_match_played": 1, "point_per_match_win": 3, "point_per_mix_participation": 2, "point_per_mix_win": 10}'::jsonb;
  END IF;

  -- per-player match wins/losses from every decided match + mix win flag +
  -- points earned (per configurable rules) — guests excluded from all of it
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
           COUNT(*) AS played,
           COUNT(*) FILTER (WHERE won) AS wins,
           COUNT(*) FILTER (WHERE NOT won) AS losses
    FROM pp
    WHERE pid IS NOT NULL
    GROUP BY pid
  ),
  scored AS (
    SELECT a.pid, a.played, a.wins, a.losses,
           (a.pid IN (
             SELECT unnest(ARRAY[player1_id, player2_id]) FROM teams WHERE id = p_winner_team_id
           )) AS won_mix
    FROM agg a
    JOIN profiles pr ON pr.id = a.pid AND pr.is_guest = FALSE
  ),
  pcalc AS (
    SELECT pid, played, wins, losses, won_mix,
           (played * COALESCE((rules->>'point_per_match_played')::int, 0)
            + wins * COALESCE((rules->>'point_per_match_win')::int, 0)
            + COALESCE((rules->>'point_per_mix_participation')::int, 0)
            + CASE WHEN won_mix THEN COALESCE((rules->>'point_per_mix_win')::int, 0) ELSE 0 END
           ) AS pts
    FROM scored
  )
  INSERT INTO player_stats (user_id, game_wins, game_losses, mix_wins, mixes_played, total_points)
  SELECT pid, wins, losses, CASE WHEN won_mix THEN 1 ELSE 0 END, 1, pts
  FROM pcalc
  ON CONFLICT (user_id) DO UPDATE
  SET game_wins    = player_stats.game_wins    + EXCLUDED.game_wins,
      game_losses  = player_stats.game_losses  + EXCLUDED.game_losses,
      mix_wins     = player_stats.mix_wins     + EXCLUDED.mix_wins,
      mixes_played = player_stats.mixes_played + EXCLUDED.mixes_played,
      total_points = player_stats.total_points + EXCLUDED.total_points,
      updated_at   = NOW();

  INSERT INTO mix_player_stats (game_id, user_id, matches_played, matches_won, points_earned, mix_won)
  SELECT p_game_id, pid, played, wins, pts, won_mix
  FROM pcalc
  ON CONFLICT (game_id, user_id) DO UPDATE
  SET matches_played = EXCLUDED.matches_played,
      matches_won    = EXCLUDED.matches_won,
      points_earned  = EXCLUDED.points_earned,
      mix_won        = EXCLUDED.mix_won;

  UPDATE games
  SET status = 'finished', winner_team_id = p_winner_team_id, updated_at = NOW()
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION finalize_mix(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION finalize_mix(UUID, UUID) TO authenticated;

-- ── 5. Head-to-head RPCs ───────────────────────────────────────────────────
-- Computed live from matches+teams (not a stored/incrementally-updated
-- table) so it's always exact and never needs a separate backfill or repair.
-- Every match contributes 8 opposing-pair rows (4 cross-team pairs × 2
-- directions), built once via a LATERAL cross join instead of 8 UNIONs.
CREATE OR REPLACE FUNCTION mix_head_to_head(p_user_id UUID)
RETURNS TABLE (
  opponent_id UUID,
  opponent_name TEXT,
  wins INTEGER,
  losses INTEGER,
  matches_played INTEGER
) AS $$
  WITH pairings AS (
    SELECT pa.pid AS pid, pb.pid AS oid,
           (m.winner_team_id = ta.id) = pa.is_a AS won
    FROM matches m
    JOIN teams ta ON ta.id = m.team_a_id
    JOIN teams tb ON tb.id = m.team_b_id
    CROSS JOIN LATERAL (VALUES
      (ta.player1_id, TRUE), (ta.player2_id, TRUE),
      (tb.player1_id, FALSE), (tb.player2_id, FALSE)
    ) AS pa(pid, is_a)
    CROSS JOIN LATERAL (VALUES
      (ta.player1_id, TRUE), (ta.player2_id, TRUE),
      (tb.player1_id, FALSE), (tb.player2_id, FALSE)
    ) AS pb(pid, is_a)
    WHERE m.winner_team_id IS NOT NULL
      AND pa.is_a <> pb.is_a
  )
  SELECT p.oid, pr.name,
         COUNT(*) FILTER (WHERE p.won)::INTEGER,
         COUNT(*) FILTER (WHERE NOT p.won)::INTEGER,
         COUNT(*)::INTEGER
  FROM pairings p
  JOIN profiles pr ON pr.id = p.oid AND pr.is_guest = FALSE
  WHERE p.pid = p_user_id
  GROUP BY p.oid, pr.name
  ORDER BY 3 DESC, 4 ASC, pr.name;
$$ LANGUAGE sql STABLE;

REVOKE EXECUTE ON FUNCTION mix_head_to_head(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION mix_head_to_head(UUID) TO authenticated;

-- Full match history between two specific players.
CREATE OR REPLACE FUNCTION mix_head_to_head_matches(p_user_id UUID, p_opponent_id UUID)
RETURNS TABLE (
  match_id UUID,
  game_id UUID,
  game_title TEXT,
  match_date TIMESTAMPTZ,
  round_number INTEGER,
  phase TEXT,
  player_score INTEGER,
  opponent_score INTEGER,
  won BOOLEAN
) AS $$
  SELECT m.id, g.id, g.title, g.date, m.round_number, m.phase,
         CASE WHEN pa.is_a THEN m.score_a ELSE m.score_b END,
         CASE WHEN pa.is_a THEN m.score_b ELSE m.score_a END,
         (m.winner_team_id = ta.id) = pa.is_a
  FROM matches m
  JOIN teams ta ON ta.id = m.team_a_id
  JOIN teams tb ON tb.id = m.team_b_id
  JOIN games g ON g.id = m.game_id
  CROSS JOIN LATERAL (VALUES
    (ta.player1_id, TRUE), (ta.player2_id, TRUE),
    (tb.player1_id, FALSE), (tb.player2_id, FALSE)
  ) AS pa(pid, is_a)
  CROSS JOIN LATERAL (VALUES
    (ta.player1_id, TRUE), (ta.player2_id, TRUE),
    (tb.player1_id, FALSE), (tb.player2_id, FALSE)
  ) AS pb(pid, is_a)
  WHERE m.winner_team_id IS NOT NULL
    AND pa.is_a <> pb.is_a
    AND pa.pid = p_user_id AND pb.pid = p_opponent_id
  ORDER BY g.date DESC, m.round_number DESC;
$$ LANGUAGE sql STABLE;

REVOKE EXECUTE ON FUNCTION mix_head_to_head_matches(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION mix_head_to_head_matches(UUID, UUID) TO authenticated;
