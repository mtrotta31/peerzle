-- Migration: Add admin role to memberships
-- This allows community administrators to manage members and view analytics

-- First, drop the existing check constraint on role (if any) and add new one
-- Note: The original schema didn't have a CHECK constraint, so we add one now
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('seeker', 'helper', 'both', 'admin'));

-- Make matt.trotta31@gmail.com an admin for the first-responders community
UPDATE memberships
SET role = 'admin'
WHERE user_id = (SELECT id FROM users WHERE email = 'matt.trotta31@gmail.com')
  AND community_id = (SELECT id FROM communities WHERE slug = 'first-responders');

COMMENT ON COLUMN memberships.role IS 'User role in community: seeker, helper, both, or admin';
