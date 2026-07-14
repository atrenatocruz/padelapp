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

-- Results: Anyone can view, participants and admins can submit
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results are viewable by everyone"
  ON results FOR SELECT
  USING (true);

CREATE POLICY "Participants and admins can submit results"
  ON results FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by AND (
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

CREATE POLICY "Stats are viewable by everyone"
  ON player_stats FOR SELECT
  USING (true);

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
CREATE OR REPLACE FUNCTION update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats for all 4 players
  -- Team 1 players
  INSERT INTO player_stats (user_id, games_played, games_won, total_points_scored, total_points_conceded)
  VALUES (NEW.team1_player1_id, 1, 
          CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
          NEW.team1_score, NEW.team2_score)
  ON CONFLICT (user_id) DO UPDATE
  SET games_played = player_stats.games_played + 1,
      games_won = player_stats.games_won + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      total_points_scored = player_stats.total_points_scored + NEW.team1_score,
      total_points_conceded = player_stats.total_points_conceded + NEW.team2_score,
      updated_at = NOW();
      
  INSERT INTO player_stats (user_id, games_played, games_won, total_points_scored, total_points_conceded)
  VALUES (NEW.team1_player2_id, 1,
          CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
          NEW.team1_score, NEW.team2_score)
  ON CONFLICT (user_id) DO UPDATE
  SET games_played = player_stats.games_played + 1,
      games_won = player_stats.games_won + CASE WHEN NEW.team1_score > NEW.team2_score THEN 1 ELSE 0 END,
      total_points_scored = player_stats.total_points_scored + NEW.team1_score,
      total_points_conceded = player_stats.total_points_conceded + NEW.team2_score,
      updated_at = NOW();
  
  -- Team 2 players
  INSERT INTO player_stats (user_id, games_played, games_won, total_points_scored, total_points_conceded)
  VALUES (NEW.team2_player1_id, 1,
          CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
          NEW.team2_score, NEW.team1_score)
  ON CONFLICT (user_id) DO UPDATE
  SET games_played = player_stats.games_played + 1,
      games_won = player_stats.games_won + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      total_points_scored = player_stats.total_points_scored + NEW.team2_score,
      total_points_conceded = player_stats.total_points_conceded + NEW.team1_score,
      updated_at = NOW();
      
  INSERT INTO player_stats (user_id, games_played, games_won, total_points_scored, total_points_conceded)
  VALUES (NEW.team2_player2_id, 1,
          CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
          NEW.team2_score, NEW.team1_score)
  ON CONFLICT (user_id) DO UPDATE
  SET games_played = player_stats.games_played + 1,
      games_won = player_stats.games_won + CASE WHEN NEW.team2_score > NEW.team1_score THEN 1 ELSE 0 END,
      total_points_scored = player_stats.total_points_scored + NEW.team2_score,
      total_points_conceded = player_stats.total_points_conceded + NEW.team1_score,
      updated_at = NOW();
  
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
  INSERT INTO public.profiles (id, name, email, birthday, gender, phone, level, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Utilizador'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'gender', NULL),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    'iniciante',
    FALSE
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

