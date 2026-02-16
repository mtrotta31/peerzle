-- Migration: Daily Mood Check-Ins
-- Creates mood_checkins table for standalone and conversation-triggered check-ins
-- Backfills existing conversation mood data

-- Main mood check-ins table
CREATE TABLE mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  -- 1 = Much Worse, 2 = Slightly Down, 3 = Neutral, 4 = Okay, 5 = Good
  source VARCHAR(20) NOT NULL DEFAULT 'standalone',
  -- 'standalone' = daily check-in, 'conversation' = pre-conversation mood check
  note TEXT,
  -- Optional short note from user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_mood_checkins_user ON mood_checkins(user_id, created_at DESC);
CREATE INDEX idx_mood_checkins_org ON mood_checkins(organization_id, created_at DESC);
CREATE INDEX idx_mood_checkins_community ON mood_checkins(community_id, created_at DESC);
-- Note: idx_mood_checkins_user already covers date-based queries with created_at DESC

-- Table comments
COMMENT ON TABLE mood_checkins IS 'Unified mood check-in data from both standalone daily check-ins and conversation-triggered checks';
COMMENT ON COLUMN mood_checkins.mood_score IS '1=Much Worse, 2=Slightly Down, 3=Neutral, 4=Okay, 5=Good';
COMMENT ON COLUMN mood_checkins.source IS 'standalone=daily check-in, conversation=pre-conversation mood';

-- User preference for daily mood check-in notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS mood_checkin_notifications BOOLEAN DEFAULT true;

COMMENT ON COLUMN users.mood_checkin_notifications IS 'Whether user wants daily mood check-in push notifications';

-- Track when daily check-in notifications were sent to avoid duplicates
CREATE TABLE mood_checkin_notification_log (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_sent_date DATE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE mood_checkin_notification_log IS 'Tracks last daily check-in notification sent to each user';

-- Track PeerBot nudges sent for concerning mood patterns
CREATE TABLE mood_nudge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  nudge_type VARCHAR(50) NOT NULL DEFAULT 'consecutive_low',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mood_nudge_log_user ON mood_nudge_log(user_id, sent_at DESC);

COMMENT ON TABLE mood_nudge_log IS 'Tracks PeerBot nudges sent for concerning mood patterns';

-- Backfill existing conversation mood data
-- This unifies all mood data into one table for analytics
INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
SELECT
  u.id as user_id,
  c.community_id,
  m.organization_id,
  c.seeker_pre_mood as mood_score,
  'conversation' as source,
  c.started_at as created_at
FROM conversations c
JOIN memberships m ON c.seeker_membership_id = m.id
JOIN users u ON m.user_id = u.id
WHERE c.seeker_pre_mood IS NOT NULL;
