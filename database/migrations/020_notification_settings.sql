-- Migration 020: Add helper match notifications preference
-- Adds a toggle for users to control helper match push notifications

ALTER TABLE users ADD COLUMN IF NOT EXISTS helper_match_notifications BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.helper_match_notifications IS 'Whether user wants push notifications when matched with a helper';
