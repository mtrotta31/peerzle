-- Migration 015: Super Admin Role
-- Platform-level admin role for the Peerzle team
-- Separate from community-level admin role on memberships table

-- 1. Add is_super_admin column to users table
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false;

-- 2. Set initial super admin
UPDATE users SET is_super_admin = true WHERE email = 'matt.trotta31@gmail.com';

-- 3. Create index for quick lookup
CREATE INDEX idx_users_is_super_admin ON users(is_super_admin) WHERE is_super_admin = true;
