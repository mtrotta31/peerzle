-- Migration: Add conversation_ratings table for post-session feedback
-- This allows users to rate their conversation experience after a session ends

CREATE TABLE conversation_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('seeker', 'helper')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    felt_heard BOOLEAN,  -- seeker only: "Did you feel heard?"
    would_recommend BOOLEAN,  -- "Would you recommend Peerzle?"
    feedback_text TEXT,  -- optional open-ended feedback
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, membership_id)  -- one rating per person per conversation
);

CREATE INDEX idx_conversation_ratings_conversation_id ON conversation_ratings(conversation_id);
CREATE INDEX idx_conversation_ratings_membership_id ON conversation_ratings(membership_id);
CREATE INDEX idx_conversation_ratings_created_at ON conversation_ratings(created_at DESC);

COMMENT ON TABLE conversation_ratings IS 'Stores user feedback and ratings after peer support conversations end';
COMMENT ON COLUMN conversation_ratings.role IS 'The role of the rater in the conversation: seeker or helper';
COMMENT ON COLUMN conversation_ratings.felt_heard IS 'Seeker-only field: Did you feel heard during the conversation?';
COMMENT ON COLUMN conversation_ratings.would_recommend IS 'Would you recommend Peerzle to others?';
