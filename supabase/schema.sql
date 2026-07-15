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
