-- ════════════════════════════════════════════════════════════════════════
-- Fix: "Erro ao atualizar perfil" when saving the level dropdown on the
-- Profile page. `memberships` has RLS enabled but only SELECT policies —
-- AuthContext.updateMembership()'s UPDATE was silently blocked (0 rows
-- affected), and the follow-up .single() then threw on finding no row.
--
-- Scoped to the `level` column only (not a blanket UPDATE policy): promoting
-- to admin is deliberately routed through admin_set_membership_admin()
-- (SECURITY DEFINER) so a member can't just PATCH their own is_admin/is_guest
-- via a direct table update. Column-level GRANT enforces that even though
-- the RLS policy below matches the whole row.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can update own membership level"
  ON memberships FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE ON memberships FROM authenticated;
GRANT UPDATE (level) ON memberships TO authenticated;
