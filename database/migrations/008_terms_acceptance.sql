-- Migration: Terms of Service Acceptance
-- Adds columns to track TOS acceptance and creates a log table for audit trail

-- Add TOS columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tos_version VARCHAR(20);

COMMENT ON COLUMN users.tos_accepted_at IS 'Timestamp when the user accepted the Terms of Service';
COMMENT ON COLUMN users.tos_version IS 'Version of the Terms of Service the user accepted';

-- Create TOS acceptance log table for audit trail
CREATE TABLE IF NOT EXISTS tos_acceptance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

COMMENT ON TABLE tos_acceptance_log IS 'Audit log of all Terms of Service acceptances by users';
COMMENT ON COLUMN tos_acceptance_log.user_id IS 'Reference to the user who accepted the terms';
COMMENT ON COLUMN tos_acceptance_log.version IS 'Version of the Terms of Service that was accepted';
COMMENT ON COLUMN tos_acceptance_log.accepted_at IS 'Timestamp when the terms were accepted';
COMMENT ON COLUMN tos_acceptance_log.ip_address IS 'IP address from which the acceptance was made';

-- Create index on user_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tos_acceptance_log_user_id ON tos_acceptance_log(user_id);
