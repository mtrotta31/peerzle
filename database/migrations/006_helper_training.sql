-- Migration 006: Helper Training Module
-- Requires helpers to complete training before going available

-- Add training_completed column to memberships
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS training_completed BOOLEAN DEFAULT false;

-- Table to track progress through training modules
CREATE TABLE IF NOT EXISTS helper_training_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    module_number INTEGER NOT NULL CHECK (module_number BETWEEN 1 AND 3),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    score INTEGER CHECK (score BETWEEN 0 AND 100),

    -- Each user can only complete each module once per community membership
    UNIQUE(membership_id, module_number)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_membership ON helper_training_progress(membership_id);

COMMENT ON TABLE helper_training_progress IS 'Tracks helper progress through training modules';
COMMENT ON COLUMN helper_training_progress.module_number IS 'Module 1-3: How Peerzle Works, How to Respond, Crisis Recognition';
COMMENT ON COLUMN helper_training_progress.score IS 'Quiz score as percentage (0-100)';
