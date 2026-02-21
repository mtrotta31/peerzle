-- Migration 023: Make seeker_membership_id nullable for demo seeker conversations
-- Demo seeker conversations have a simulated seeker (PeerBot), so there's no real membership

ALTER TABLE conversations ALTER COLUMN seeker_membership_id DROP NOT NULL;

COMMENT ON COLUMN conversations.seeker_membership_id IS
  'The membership ID of the seeker. NULL for demo seeker conversations where PeerBot acts as the seeker.';
