-- ════════════════════════════════════════════════════════════════════════
-- Migration: multi-tenant rebuild (clean slate — current data is test
-- data only, confirmed disposable). Run this whole file in Supabase →
-- SQL Editor → New query → Run.
--
-- This DROPS every existing table and function from the single-tenant
-- schema and replaces them with the multi-tenant one (see
-- docs/superpowers/specs/2026-07-16-multi-tenant-design.md and
-- supabase/schema.sql, which this file mirrors exactly).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Drop everything from the old single-tenant schema ────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP TABLE IF EXISTS mix_player_stats CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS check_game_full() CASCADE;
DROP FUNCTION IF EXISTS check_game_reopen() CASCADE;
DROP FUNCTION IF EXISTS update_player_stats() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS finalize_mix(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS admin_delete_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS admin_set_admin(UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS mix_head_to_head(UUID) CASCADE;
DROP FUNCTION IF EXISTS mix_head_to_head_matches(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS assign_game_short_code() CASCADE;
DROP FUNCTION IF EXISTS prevent_self_admin_escalation() CASCADE;

-- ── 2. Apply the new multi-tenant schema ─────────────────────────────────
-- (identical to supabase/schema.sql — kept in sync manually; schema.sql
-- is the source of truth for what a fresh install looks like)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  whatsapp_group_jid TEXT,
  robot_contact TEXT,
  group_logo_url TEXT,
  points_rules JSONB NOT NULL DEFAULT
    '{"point_per_match_played": 1, "point_per_match_win": 3, "point_per_mix_participation": 2, "point_per_mix_win": 10}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  birthday DATE,
  gender TEXT,
  phone_hash TEXT,
  preferred_side TEXT NOT NULL DEFAULT 'both' CHECK (preferred_side IN ('left', 'right', 'both')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  level TEXT NOT NULL DEFAULT 'iniciante',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  location TEXT,
  max_players INTEGER DEFAULT 4,
  num_courts INTEGER NOT NULL DEFAULT 1,
  court_time_minutes INTEGER NOT NULL DEFAULT 90,
  game_time_minutes INTEGER NOT NULL DEFAULT 20,
  format TEXT NOT NULL DEFAULT 'sobe_desce' CHECK (format IN ('sobe_desce', 'todos_contra_todos')),
  status TEXT DEFAULT 'open',
  winner_team_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  partner_id UUID REFERENCES profiles(id),
  team_number INTEGER,
  status TEXT DEFAULT 'pending',
  joined_alone BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE UNIQUE INDEX participants_game_user_key ON participants(game_id, user_id);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES profiles(id),
  player2_id UUID NOT NULL REFERENCES profiles(id),
  seed_ranking DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE matches (
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
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  game_wins INTEGER NOT NULL DEFAULT 0,
  game_losses INTEGER NOT NULL DEFAULT 0,
  mix_wins INTEGER NOT NULL DEFAULT 0,
  mixes_played INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE mix_player_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  mix_won BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (game_id, user_id)
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE mix_player_stats ENABLE ROW LEVEL SECURITY;

-- Admin-check helper, SECURITY DEFINER so it bypasses RLS internally —
-- avoids infinite recursion (42P17) that a direct self-subquery on
-- `memberships` would cause (see migration_fix_membership_recursion.sql).
CREATE OR REPLACE FUNCTION is_org_admin(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_admin
  );
$$;

REVOKE ALL ON FUNCTION is_org_admin(UUID) FROM public;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID) TO authenticated;

CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = organizations.id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = organizations.id
      AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "See own profile or profiles of org-mates"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "See own memberships"
  ON memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org admins see all memberships in their org"
  ON memberships FOR SELECT
  USING (is_org_admin(organization_id));

CREATE POLICY "Org members can view games"
  ON games FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = games.organization_id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Org admins can create games"
  ON games FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = games.organization_id
      AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org admins can update games"
  ON games FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = games.organization_id
      AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org admins can delete games"
  ON games FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = games.organization_id
      AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org members can view participants"
  ON participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = participants.game_id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Users can join games in their org"
  ON participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
      WHERE games.id = participants.game_id AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their participation"
  ON participants FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave games"
  ON participants FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins can manage participants"
  ON participants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = participants.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = participants.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org members can view teams"
  ON teams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = teams.game_id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Org admins manage teams"
  ON teams FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = teams.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = teams.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org members can view matches"
  ON matches FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = matches.game_id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Org admins manage matches"
  ON matches FOR ALL
  USING (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = matches.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM games JOIN memberships ON memberships.organization_id = games.organization_id
    WHERE games.id = matches.game_id AND memberships.user_id = auth.uid() AND memberships.is_admin
  ));

CREATE POLICY "Org members can view player stats"
  ON player_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = player_stats.organization_id AND memberships.user_id = auth.uid()
  ));

CREATE POLICY "Org members can view mix player stats"
  ON mix_player_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.organization_id = mix_player_stats.organization_id AND memberships.user_id = auth.uid()
  ));

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER game_full_trigger
AFTER INSERT OR UPDATE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_full();

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER game_reopen_trigger
AFTER DELETE ON participants
FOR EACH ROW EXECUTE FUNCTION check_game_reopen();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, birthday, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Utilizador'),
    COALESCE(NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, NULL),
    COALESCE(NEW.raw_user_meta_data->>'gender', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION join_organization(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations WHERE slug = p_slug;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada';
  END IF;

  INSERT INTO memberships (user_id, organization_id)
  VALUES (auth.uid(), v_org_id)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION join_organization(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION join_organization(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION finalize_mix(p_game_id UUID, p_winner_team_id UUID)
RETURNS void AS $$
DECLARE
  rules JSONB;
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM games WHERE id = p_game_id;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = v_org_id AND user_id = auth.uid() AND is_admin
  ) THEN
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

  SELECT points_rules INTO rules FROM organizations WHERE id = v_org_id;
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
    JOIN memberships mb ON mb.user_id = a.pid AND mb.organization_id = v_org_id AND NOT mb.is_guest
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
  INSERT INTO player_stats (user_id, organization_id, game_wins, game_losses, mix_wins, mixes_played, total_points)
  SELECT pid, v_org_id, wins, losses, CASE WHEN won_mix THEN 1 ELSE 0 END, 1, pts
  FROM pcalc
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET game_wins    = player_stats.game_wins    + EXCLUDED.game_wins,
      game_losses  = player_stats.game_losses  + EXCLUDED.game_losses,
      mix_wins     = player_stats.mix_wins     + EXCLUDED.mix_wins,
      mixes_played = player_stats.mixes_played + EXCLUDED.mixes_played,
      total_points = player_stats.total_points + EXCLUDED.total_points,
      updated_at   = NOW();

  INSERT INTO mix_player_stats (game_id, user_id, organization_id, matches_played, matches_won, points_earned, mix_won)
  SELECT p_game_id, pid, v_org_id, played, wins, pts, won_mix
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION finalize_mix(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION finalize_mix(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION mix_head_to_head(p_user_id UUID, p_organization_id UUID)
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
    JOIN games g ON g.id = m.game_id AND g.organization_id = p_organization_id
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
  JOIN memberships mb ON mb.user_id = p.oid AND mb.organization_id = p_organization_id AND NOT mb.is_guest
  JOIN profiles pr ON pr.id = p.oid
  WHERE p.pid = p_user_id
  GROUP BY p.oid, pr.name
  ORDER BY 3 DESC, 4 ASC, pr.name;
$$ LANGUAGE sql STABLE;

REVOKE EXECUTE ON FUNCTION mix_head_to_head(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION mix_head_to_head(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION mix_head_to_head_matches(p_user_id UUID, p_opponent_id UUID, p_organization_id UUID)
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
  JOIN games g ON g.id = m.game_id AND g.organization_id = p_organization_id
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

REVOKE EXECUTE ON FUNCTION mix_head_to_head_matches(UUID, UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION mix_head_to_head_matches(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION admin_remove_member(p_organization_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_admin
  ) THEN
    RAISE EXCEPTION 'Apenas admins podem remover membros';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não podes remover-te a ti próprio';
  END IF;

  DELETE FROM memberships WHERE organization_id = p_organization_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION admin_remove_member(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_remove_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION admin_set_membership_admin(p_organization_id UUID, p_user_id UUID, p_is_admin BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE organization_id = p_organization_id AND user_id = auth.uid() AND is_admin
  ) THEN
    RAISE EXCEPTION 'Apenas admins podem alterar permissões de administrador';
  END IF;
  IF p_user_id = auth.uid() AND p_is_admin = FALSE THEN
    RAISE EXCEPTION 'Não podes remover a tua própria permissão de admin';
  END IF;

  UPDATE memberships SET is_admin = p_is_admin
  WHERE organization_id = p_organization_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION admin_set_membership_admin(UUID, UUID, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_set_membership_admin(UUID, UUID, BOOLEAN) TO authenticated;

-- ── 3. Seed a test organization so there's something to sign up into ────
INSERT INTO organizations (name, slug) VALUES ('Os Padeleiros', 'os-padeleiros');
