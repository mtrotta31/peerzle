-- Migration 019: Clear Invalid Push Subscriptions
-- All existing push subscriptions were created with incorrect VAPID keys
-- and are permanently invalid. Users will re-subscribe automatically
-- when they next open the app.

-- Clear all invalid subscriptions
DELETE FROM push_subscriptions;

-- Add a comment to track when this was done
COMMENT ON TABLE push_subscriptions IS 'Push subscriptions cleared 2024-02 due to VAPID key mismatch. Users re-subscribe automatically.';
