-- Migration: User Onboarding and Experience Profiles
-- Adds topic selection, self-ratings, and onboarding tracking for matching

-- Experience topics selected by each user per community
CREATE TABLE IF NOT EXISTS user_experience_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    topic VARCHAR(100) NOT NULL,
    history_rating INTEGER NOT NULL CHECK (history_rating BETWEEN 1 AND 10),
    knowledge_rating INTEGER NOT NULL CHECK (knowledge_rating BETWEEN 1 AND 10),
    coping_rating INTEGER NOT NULL CHECK (coping_rating BETWEEN 1 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(membership_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_experience_topics_membership ON user_experience_topics(membership_id);

COMMENT ON TABLE user_experience_topics IS 'Topics users have experience with, including self-ratings for matching';
COMMENT ON COLUMN user_experience_topics.history_rating IS 'How frequently user has experienced this (1=rarely, 10=very often)';
COMMENT ON COLUMN user_experience_topics.knowledge_rating IS 'How much user knows about this topic (1=little, 10=expert)';
COMMENT ON COLUMN user_experience_topics.coping_rating IS 'How well user manages this (1=struggling, 10=managing well)';

-- Add onboarding fields to memberships
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);

-- Ensure profile column exists (may already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memberships' AND column_name = 'profile'
    ) THEN
        ALTER TABLE memberships ADD COLUMN profile JSONB DEFAULT '{}';
    END IF;
END $$;

COMMENT ON COLUMN memberships.onboarding_completed IS 'Whether user has completed the onboarding flow for this community';
COMMENT ON COLUMN memberships.display_name IS 'Anonymous display name for conversations in this community';
