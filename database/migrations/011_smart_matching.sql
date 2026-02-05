-- Migration: Smart Matching Algorithm
-- Adds match_score column to conversations for analytics

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100);

COMMENT ON COLUMN conversations.match_score IS 'Score (0-100) representing how well the helper was matched to this conversation';
