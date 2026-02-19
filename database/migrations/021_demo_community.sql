-- Migration 021: Add demo flag to communities
-- Allows marking communities as demo mode for sales/testing purposes

ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Index for efficient demo community lookups
CREATE INDEX IF NOT EXISTS idx_communities_is_demo ON communities(is_demo) WHERE is_demo = true;

COMMENT ON COLUMN communities.is_demo IS 'When true, conversations bypass real matching and connect directly to PeerBot';
