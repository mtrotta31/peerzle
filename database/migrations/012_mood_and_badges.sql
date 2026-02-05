-- Migration: Pre-Chat Mood Check + Post-Chat Badges and Save
-- Adds mood tracking, compliment badges, and conversation save functionality

-- Pre-chat and post-chat mood (1-5 scale)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seeker_pre_mood INTEGER CHECK (seeker_pre_mood >= 1 AND seeker_pre_mood <= 5);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seeker_post_mood INTEGER CHECK (seeker_post_mood >= 1 AND seeker_post_mood <= 5);

-- Helper compliment badges selected by seeker after conversation
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS helper_compliment_badges TEXT[];

-- Array of user_ids who saved this conversation for personal reflection
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS conversation_saved_by UUID[];

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_conversations_seeker_pre_mood ON conversations(seeker_pre_mood) WHERE seeker_pre_mood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_seeker_post_mood ON conversations(seeker_post_mood) WHERE seeker_post_mood IS NOT NULL;

COMMENT ON COLUMN conversations.seeker_pre_mood IS 'Seeker mood before conversation (1=Much Worse, 2=Slightly Down, 3=Neutral, 4=Okay, 5=Good)';
COMMENT ON COLUMN conversations.seeker_post_mood IS 'Seeker mood after conversation (same scale as pre_mood)';
COMMENT ON COLUMN conversations.helper_compliment_badges IS 'Compliment badges given to the helper by the seeker';
COMMENT ON COLUMN conversations.conversation_saved_by IS 'User IDs who saved this conversation for personal reflection';
