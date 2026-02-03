-- Migration 004: Community Join Flow
-- Adds verification controls and invite codes for community access

-- Add new columns to communities table
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update verification_method to have 'open' as an option (default was 'invite_code')
-- We'll set existing communities to 'open' if they don't have specific verification
UPDATE communities
SET verification_method = 'open'
WHERE verification_method = 'invite_code';

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_uses INTEGER DEFAULT NULL,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_community_id ON invite_codes(community_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_active ON invite_codes(is_active) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON TABLE invite_codes IS 'Invite codes for community access control';
COMMENT ON COLUMN communities.verification_method IS 'Access control method: open, invite_code, email_domain';
COMMENT ON COLUMN communities.allowed_email_domains IS 'Array of allowed email domain suffixes for email_domain verification';
COMMENT ON COLUMN communities.is_public IS 'Whether community appears in public browse list';
