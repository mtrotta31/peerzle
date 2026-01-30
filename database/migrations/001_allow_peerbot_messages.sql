-- Migration: Allow PeerBot messages (sender_membership_id can be null)
-- PeerBot messages are identified by moderation_result->>'sender' = 'peerbot'

ALTER TABLE messages
ALTER COLUMN sender_membership_id DROP NOT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN messages.sender_membership_id IS
'NULL for PeerBot AI messages. Check moderation_result->>''sender'' = ''peerbot'' to identify AI messages.';
