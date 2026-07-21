-- ════════════════════════════════════════════════════════════════════════
-- Fix: "See own profile or profiles of org-mates" silently collapsed to
-- "see own profile only" for every non-admin user.
--
-- The policy's EXISTS subquery joined memberships m1/m2 to check whether
-- the caller shares an org with the target profile — but that subquery
-- runs under the CALLING user's RLS, and memberships' own "See own
-- memberships" policy only lets a non-admin see their OWN row. So m2
-- could only ever match the caller's own membership, never anyone
-- else's — non-admins could only ever see their own profile, breaking
-- every roster/rankings/partner-name view that embeds another person's
-- profile. Admins were unaffected (their separate "Org admins see all
-- memberships" policy lets m2 resolve to anyone), which is why this went
-- unnoticed — most testing happens as admin.
--
-- Fix mirrors the existing is_org_admin() pattern: move the check into a
-- SECURITY DEFINER function, which bypasses memberships' RLS internally
-- instead of being constrained by it.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- (Already applied directly to production during the incident — this
-- file documents it and brings schema.sql/fresh installs in line.)
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION shares_org_with(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION shares_org_with(UUID) FROM public;
GRANT EXECUTE ON FUNCTION shares_org_with(UUID) TO authenticated;

DROP POLICY IF EXISTS "See own profile or profiles of org-mates" ON profiles;
CREATE POLICY "See own profile or profiles of org-mates"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR shares_org_with(id)
  );
