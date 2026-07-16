-- ════════════════════════════════════════════════════════════════════════
-- Migration: fixes for SECURITY_REVIEW.md findings #1, #2, #3, #7, #8.
-- Run this whole file in Supabase → SQL Editor → New query → Run.
--
-- Not covered here (see SECURITY_REVIEW.md for why):
--   #4, #10 — Supabase dashboard settings, not SQL.
--   #5      — dependency bumps, handled via `npm audit fix` in the repo.
--   #6      — vercel.json headers, not SQL.
--   #2      — this migration applies the "mínimo" tier only (restrict
--              profiles SELECT to authenticated users). The "ideal" tier
--              (hide email/phone/birthday from other members behind a
--              profiles_public view) needs a coordinated frontend pass
--              across every profiles select() and isn't done here.
--   #9      — explicitly deferred by the audit itself (low priority).
-- ════════════════════════════════════════════════════════════════════════

-- ── Fix #1: nobody can promote themselves to admin (or un-flag themselves
--    as guest) via a direct profiles UPDATE — only an existing admin, via
--    the new admin_set_admin() RPC below, can change either column. ──────
CREATE OR REPLACE FUNCTION prevent_self_admin_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.is_guest IS DISTINCT FROM OLD.is_guest)
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem alterar is_admin/is_guest';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_self_admin_escalation_trigger ON profiles;
CREATE TRIGGER prevent_self_admin_escalation_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_self_admin_escalation();

-- RPC so an existing admin CAN still promote/demote someone else — the
-- direct-UPDATE path the app used before (src/pages/Admin.jsx
-- handleToggleAdmin) never actually worked cross-user (RLS blocked it
-- silently); this replaces it, mirroring admin_delete_user's shape.
CREATE OR REPLACE FUNCTION admin_set_admin(p_user_id UUID, p_is_admin BOOLEAN)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin) THEN
    RAISE EXCEPTION 'Apenas admins podem alterar permissões de administrador';
  END IF;
  IF p_user_id = auth.uid() AND p_is_admin = FALSE THEN
    RAISE EXCEPTION 'Não podes remover a tua própria permissão de admin';
  END IF;

  UPDATE profiles SET is_admin = p_is_admin WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION admin_set_admin(UUID, BOOLEAN) FROM anon, public;
GRANT EXECUTE ON FUNCTION admin_set_admin(UUID, BOOLEAN) TO authenticated;

-- ── Fix #2 (mínimo tier): profiles no longer readable by anyone with just
--    the anon key — only authenticated members. ──────────────────────────
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── Fix #3: the results INSERT policy compared participants.game_id to
--    itself (unqualified `game_id` inside a subquery over `participants`
--    resolves to participants.game_id, not the row being inserted into
--    results) — always true, so anyone in ANY game could submit results
--    for ANY game. Qualify both sides. ────────────────────────────────────
DROP POLICY IF EXISTS "Participants and admins can submit results" ON results;
CREATE POLICY "Participants and admins can submit results"
  ON results FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) = FALSE
    AND (
      EXISTS (
        SELECT 1 FROM participants
        WHERE participants.game_id = results.game_id AND participants.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
      )
    )
  );

-- ── Fix #7: harden all SECURITY DEFINER functions against search_path
--    hijacking (Supabase linter recommendation). ─────────────────────────
ALTER FUNCTION check_game_reopen() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION finalize_mix(uuid, uuid) SET search_path = public;
ALTER FUNCTION admin_delete_user(uuid) SET search_path = public;

-- ── Fix #8: check_game_full ran as the joining user (not SECURITY
--    DEFINER), so its UPDATE games SET status='closed' was silently
--    blocked by RLS ("Admins can update games") for every non-admin join —
--    mixes filled by regular players never actually auto-closed. Mirrors
--    the fix already applied to check_game_reopen for the same reason. ──
ALTER FUNCTION check_game_full() SECURITY DEFINER;
ALTER FUNCTION check_game_full() SET search_path = public;
