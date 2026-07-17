-- ════════════════════════════════════════════════════════════════════════
-- Fix: auto-join of fresh sign-ins to the default club never happened.
--
-- Two independent causes, both fixed here:
--
-- 1. Slug mismatch. The client auto-join called
--    join_organization(VITE_DEFAULT_ORG_SLUG) with slug 'alinho' — but
--    "Alinho" is the product's brand name, not the club's slug. The only
--    organization ever seeded is ('Os Padeleiros', 'os-padeleiros')
--    (migration_multi_tenant.sql), so the RPC raised 'Organização não
--    encontrada' on every sign-in, silently swallowed by a console.error.
--    Instead of guessing slug strings in env vars,
--    join_default_organization() below joins THE single existing
--    organization by count: exactly 1 org → join it; 0 or ≥2 → raise.
--    That makes it self-disabling the moment a second real club exists —
--    no env-var cleanup needed later. The real invite-link flow
--    (join_organization by slug) is untouched.
--
-- 2. Missing profiles for pre-multi-tenant accounts.
--    migration_multi_tenant.sql did DROP TABLE profiles CASCADE and never
--    backfilled from auth.users — the on_auth_user_created trigger only
--    fires for NEW auth users. Anyone who signed up before that migration
--    still has an auth account but NO profiles row: their profile load
--    404s (blank Nome/Email on the Profile page) and any membership
--    insert would violate the memberships.user_id → profiles(id) FK.
--    Backfilled idempotently below.
--
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Backfill profiles for auth users that predate the multi-tenant
--       migration (same defaults as handle_new_user, plus 'full_name',
--       which Google OAuth also sets in raw_user_meta_data) ──────────────
INSERT INTO public.profiles (id, name, email, birthday, gender)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', 'Novo Utilizador'),
  COALESCE(u.email, ''),
  (u.raw_user_meta_data->>'birthday')::date,
  u.raw_user_meta_data->>'gender'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ── 2. Slug-free auto-join for the single-club phase ────────────────────
CREATE OR REPLACE FUNCTION join_default_organization()
RETURNS UUID AS $$
DECLARE
  v_count BIGINT;
  v_org_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM organizations;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Auto-join indisponível: existem % organizações (esperada exatamente 1)', v_count;
  END IF;

  SELECT id INTO v_org_id FROM organizations;

  INSERT INTO memberships (user_id, organization_id)
  VALUES (auth.uid(), v_org_id)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION join_default_organization() FROM anon, public;
GRANT EXECUTE ON FUNCTION join_default_organization() TO authenticated;
