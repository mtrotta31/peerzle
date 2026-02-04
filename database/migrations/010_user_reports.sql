-- Migration 010: User Reports
-- Adds ability for users to report other users during conversations

CREATE TABLE user_reports (
  id SERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  reporter_membership_id UUID NOT NULL REFERENCES memberships(id),
  reported_membership_id UUID NOT NULL REFERENCES memberships(id),
  community_id UUID NOT NULL REFERENCES communities(id),
  category TEXT NOT NULL CHECK (category IN ('inappropriate_behavior', 'harmful_content', 'spam', 'crisis_concerns', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_reports_community ON user_reports(community_id);
CREATE INDEX idx_user_reports_conversation ON user_reports(conversation_id);
CREATE INDEX idx_user_reports_status ON user_reports(status);
