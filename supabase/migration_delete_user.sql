-- ════════════════════════════════════════════════════════════════════════
-- Migration: Admin can permanently delete a user
-- Run this whole file in Supabase → SQL Editor → New query → Run.
--
-- Deleting a user must remove the auth.users row (so they can't log back in)
-- and clean up every reference to their profile. The browser key can't touch
-- auth.users, so this runs as a SECURITY DEFINER RPC (executes as the owner,
-- bypassing RLS) guarded by an admin check.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- caller must be an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem remover utilizadores';
  END IF;

  -- can't delete yourself (avoids locking out the last admin by accident)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não podes remover-te a ti próprio';
  END IF;

  -- keep shared game history, just detach authorship
  UPDATE games SET created_by = NULL WHERE created_by = p_user_id;

  -- clear a finished mix's recorded winner if it was this player's dupla
  UPDATE games SET winner_team_id = NULL
  WHERE winner_team_id IN (
    SELECT id FROM teams WHERE player1_id = p_user_id OR player2_id = p_user_id
  );

  -- remove the user's participation, duplas (matches cascade), stats, results
  DELETE FROM participants WHERE user_id = p_user_id OR partner_id = p_user_id;
  DELETE FROM teams WHERE player1_id = p_user_id OR player2_id = p_user_id;
  DELETE FROM player_stats WHERE user_id = p_user_id;
  DELETE FROM results
   WHERE team1_player1_id = p_user_id OR team1_player2_id = p_user_id
      OR team2_player1_id = p_user_id OR team2_player2_id = p_user_id
      OR submitted_by = p_user_id;

  -- finally the account — profiles row cascades off auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION admin_delete_user(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;
