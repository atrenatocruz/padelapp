-- ════════════════════════════════════════════════════════════════════════
-- Fix: infinite recursion (42P17) in the memberships RLS policy.
--
-- "Org admins see all memberships in their org" queried `memberships`
-- from inside its own policy — any read of `memberships`, from anywhere
-- (including other tables' policies that subquery it), re-triggers this
-- same policy, forever. Standard fix: move the admin check into a
-- SECURITY DEFINER helper function, which bypasses RLS internally instead
-- of re-evaluating the policy it's used from.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

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

DROP POLICY IF EXISTS "Org admins see all memberships in their org" ON memberships;
CREATE POLICY "Org admins see all memberships in their org"
  ON memberships FOR SELECT
  USING (is_org_admin(organization_id));
