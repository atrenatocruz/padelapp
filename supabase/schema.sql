-- Os Padeleiros Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users/Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  birthday DATE,
  gender TEXT, -- 'masculino' or 'feminino'
  phone TEXT,
  level TEXT DEFAULT 'iniciante', -- iniciante, intermédio, avançado (ou N2-N6)
  is_admin BOOLEAN DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE, -- anonymous guest players
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Games/Matches table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  max_players INTEGER DEFAULT 4,
  status TEXT DEFAULT 'open', -- open, closed, completed, cancelled
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Game participants
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  partner_id UUID REFERENCES profiles(id),
  team_number INTEGER, -- 1 or 2
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
  joined_alone BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Game results
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  team1_player1_id UUID REFERENCES profiles(id),
  team1_player2_id UUID REFERENCES profiles(id),
  team2_player1_id UUID REFERENCES profiles(id),
  team2_player2_id UUID REFERENCES profiles(id),
  team1_score INTEGER,
  team2_score INTEGER,
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Player statistics/rankings
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_points_scored INTEGER DEFAULT 0,
  total_points_conceded INTEGER DEFAULT 0,
  rating DECIMAL(10,2) DEFAULT 1000.0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Group settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  robot_contact TEXT,
  group_logo_url TEXT,
  group_name TEXT DEFAULT 'Os Padeleiros',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Row Level Security (RLS) Policies

-- Profiles: Users can read all profiles, but only update their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Games: Anyone can view, admins can create/update
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

CREATE POLICY "Admins can create games"
  ON games FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update games"
  ON games FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete games"
  ON games FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Participants: Anyone can read, authenticated users can join
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join games"
  ON participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation"
  ON participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave games"
  ON participants FOR DELETE
  USING (auth.uid() = user_id);

-- Results: Anyone can view, participants and admins can submit
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results are viewable by everyone"
  ON results FOR SELECT
  USING (true);

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
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
      )
    )
  );

-- Player stats: Everyone can view, system updates
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stats viewable by registered users"
  ON player_stats FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) = FALSE
  );

-- Settings: Everyone can view, only admins can update
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Function to auto-close game when 4 players confirm
CREATE OR REPLACE FUNCTION check_game_full()
RETURNS TRIGGER AS $$
BEGIN
  -- Count confirmed participants for this game
  IF (SELECT COUNT(*) FROM participants 
      WHERE game_id = NEW.game_id AND status = 'confirmed') >= 4 THEN
    -- Update game status to closed
    UPDATE games SET status = 'closed', updated_at = NOW()
    WHERE id = NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER game_full_trigger
AFTER INSERT OR UPDATE ON participants
FOR EACH ROW
EXECUTE FUNCTION check_game_full();

-- Function to update player stats after result submission
-- Guests (is_guest = true) participate in games but never accrue stats.
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

CREATE TRIGGER update_stats_trigger
AFTER INSERT ON results
FOR EACH ROW
EXECUTE FUNCTION update_player_stats();

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, birthday, gender, phone, level, is_admin, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Utilizador'),
    COALESCE(NEW.email, ''), -- anonymous (guest) users have no email
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

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default settings
INSERT INTO settings (group_name, robot_contact) 
VALUES ('Os Padeleiros', '+351 XXX XXX XXX');


-- ════════════════════════════════════════════════════════════════════════
-- Mix engine (courts, duplas, rondas, formatos, ranking)
-- Mirrors supabase/migration_mixes.sql so fresh installs get everything.
-- ════════════════════════════════════════════════════════════════════════
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

-- Admins can update/remove any participation row (remove player from mix,
-- detach a partner). Players keep their own existing policies untouched.
DROP POLICY IF EXISTS "Admins can manage participants" ON participants;
CREATE POLICY "Admins can manage participants"
  ON participants FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));

-- Admin: permanently delete a user (removes auth.users + all references).
-- SECURITY DEFINER + admin guard; see supabase/migration_delete_user.sql.
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem remover utilizadores';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não podes remover-te a ti próprio';
  END IF;

  UPDATE games SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE games SET winner_team_id = NULL
  WHERE winner_team_id IN (
    SELECT id FROM teams WHERE player1_id = p_user_id OR player2_id = p_user_id
  );

  DELETE FROM participants WHERE user_id = p_user_id OR partner_id = p_user_id;
  DELETE FROM teams WHERE player1_id = p_user_id OR player2_id = p_user_id;
  DELETE FROM player_stats WHERE user_id = p_user_id;
  DELETE FROM results
   WHERE team1_player1_id = p_user_id OR team1_player2_id = p_user_id
      OR team2_player1_id = p_user_id OR team2_player2_id = p_user_id
      OR submitted_by = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_delete_user(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Mix statistics system — overall, monthly, per-mix, head-to-head
-- Mirrors supabase/migration_stats.sql so fresh installs get everything.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_rules JSONB NOT NULL DEFAULT
  '{"point_per_match_played": 1, "point_per_match_win": 3, "point_per_mix_participation": 2, "point_per_mix_win": 10}'::jsonb;

ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS mixes_played INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0;

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

CREATE OR REPLACE FUNCTION finalize_mix(p_game_id UUID, p_winner_team_id UUID)
RETURNS void AS $$
DECLARE
  rules JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem finalizar um mix';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND status = 'in_progress') THEN
    RAISE EXCEPTION 'O mix não está a decorrer';
  END IF;

  IF EXISTS (SELECT 1 FROM matches WHERE game_id = p_game_id AND winner_team_id IS NULL) THEN
    RAISE EXCEPTION 'Há jogos sem resultado registado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_winner_team_id AND game_id = p_game_id) THEN
    RAISE EXCEPTION 'Dupla vencedora inválida';
  END IF;

  SELECT points_rules INTO rules FROM settings LIMIT 1;
  IF rules IS NULL THEN
    rules := '{"point_per_match_played": 1, "point_per_match_win": 3, "point_per_mix_participation": 2, "point_per_mix_win": 10}'::jsonb;
  END IF;

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
