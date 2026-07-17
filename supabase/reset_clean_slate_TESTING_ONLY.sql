-- ════════════════════════════════════════════════════════════════════════
-- ⚠️  DESTRUCTIVE — ONE-OFF DATA RESET FOR END-TO-END TESTING  ⚠️
--
-- Wipes EVERY table except `organizations` — the club itself (name, slug,
-- points_rules, WhatsApp settings) survives untouched. Everything else,
-- including every login account (auth.users), is deleted. After this
-- runs there's one empty club and nothing else: zero profiles, zero
-- memberships, zero mixes, zero stats. Everyone — including you — has to
-- sign in again from scratch. That's the point: a real, from-zero
-- end-to-end test of sign in → auto-join (join_default_organization) →
-- create a mix → play it → finalize it.
--
-- This is NOT a schema migration. Do not fold it into the regular
-- migration chain, do not re-run it "just in case", and never point it
-- at a database with real users' data you care about. Run it once, in
-- Supabase → SQL Editor → New query → Run, only when you actually mean it.
--
-- Deletion order matters: children before parents, so every foreign key
-- resolves cleanly regardless of which relationships cascade and which
-- don't. games → participants/teams/matches/mix_player_stats DO cascade;
-- profiles → games.created_by/participants/teams/player_stats/
-- mix_player_stats do NOT (see schema.sql), so anything referencing a
-- profile has to go before profiles does, and auth.users last of all.
-- ════════════════════════════════════════════════════════════════════════

DELETE FROM matches;
DELETE FROM mix_player_stats;
DELETE FROM teams;
DELETE FROM participants;
DELETE FROM player_stats;
DELETE FROM games;
DELETE FROM memberships;
DELETE FROM profiles;
DELETE FROM auth.users;

-- organizations is deliberately untouched — the club itself survives.
