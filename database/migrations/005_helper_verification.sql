-- Migration 005: Helper Verification System
-- Adds verification request workflow for peer support specialists

CREATE TABLE IF NOT EXISTS helper_verification_requests (
    id SERIAL PRIMARY KEY,
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualifications TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status values: 'pending', 'approved', 'denied'
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each user can only have one active request per community
    UNIQUE(user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_community_id ON helper_verification_requests(community_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON helper_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON helper_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_pending ON helper_verification_requests(community_id, status) WHERE status = 'pending';

COMMENT ON TABLE helper_verification_requests IS 'Verification requests for helper/specialist status';
COMMENT ON COLUMN helper_verification_requests.qualifications IS 'Free text describing training, certifications, experience';
COMMENT ON COLUMN helper_verification_requests.status IS 'Request status: pending, approved, denied';
