-- Migration 022: Add demo seeker flag to conversations
-- For Wave 3: Helper flow simulation where PeerBot acts as seeker

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_demo_seeker BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_is_demo_seeker
  ON conversations(is_demo_seeker) WHERE is_demo_seeker = true;

COMMENT ON COLUMN conversations.is_demo_seeker IS
  'When true, this conversation has a simulated seeker (PeerBot) for demo helper experience';
