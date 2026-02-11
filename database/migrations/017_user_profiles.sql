-- Migration 017: User Profile Enhancements
-- Add real name fields and emergency contacts for safety purposes

-- 1. Add first_name and last_name columns to users table
ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);

COMMENT ON COLUMN users.first_name IS 'User real first name - visible only to admins in safety contexts';
COMMENT ON COLUMN users.last_name IS 'User real last name - visible only to admins in safety contexts';

-- 2. Create emergency_contacts table
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_name VARCHAR(200) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  relationship VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE emergency_contacts IS 'Emergency contact information for users - one per user';
COMMENT ON COLUMN emergency_contacts.relationship IS 'Relationship to user (e.g., Parent, Spouse, Friend, Sibling)';

-- 3. Create index for quick lookup by user
CREATE INDEX idx_emergency_contacts_user ON emergency_contacts(user_id);
