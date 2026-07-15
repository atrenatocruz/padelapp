-- ════════════════════════════════════════════════════════════════════════
-- Migration: Admin tools — remove players from a mix, edit duplas
-- Run this whole file in Supabase → SQL Editor → New query → Run.
-- (Teams already have an admin-write policy; participants did not.)
-- ════════════════════════════════════════════════════════════════════════

-- Admins can update/remove any participation row (remove player from mix,
-- detach a partner). Players keep their own existing policies untouched.
DROP POLICY IF EXISTS "Admins can manage participants" ON participants;
CREATE POLICY "Admins can manage participants"
  ON participants FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin));
