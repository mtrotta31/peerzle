-- Migration 014: Push Subscriptions for Web Push Notifications
-- Stores push notification subscriptions so helpers get notified when someone needs support

-- 1. Create push_subscriptions table
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- A user can have multiple devices, but each device (endpoint) should be unique per user
    UNIQUE(user_id, endpoint)
);

-- Index for efficient lookup by user_id when sending notifications
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
