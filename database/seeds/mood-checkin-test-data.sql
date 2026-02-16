-- Seed: Mock Mood Check-In Data for Testing Admin Analytics
-- Run with: psql $DATABASE_URL -f database/seeds/mood-checkin-test-data.sql
--
-- Prerequisites:
-- 1. First Responders community must exist
-- 2. Run this AFTER the base schema and migrations
--
-- This creates:
-- - 2 organizations (one with 12 users, one with 3 users for privacy threshold testing)
-- - 30 days of mood check-in data
-- - Patterns for alert testing: consecutive lows, declining trends, disengaged users

-- Create test organizations if they don't exist
INSERT INTO organizations (id, community_id, name, slug, settings)
SELECT
  'a1111111-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM communities WHERE slug = 'first-responders'),
  'Test Fire Department',
  'test-fire-dept',
  '{"matchingScope": "organization"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM organizations
  WHERE slug = 'test-fire-dept'
    AND community_id = (SELECT id FROM communities WHERE slug = 'first-responders')
);

INSERT INTO organizations (id, community_id, name, slug, settings)
SELECT
  'a2222222-2222-2222-2222-222222222222'::uuid,
  (SELECT id FROM communities WHERE slug = 'first-responders'),
  'Small Station (Privacy Test)',
  'small-station-test',
  '{"matchingScope": "organization"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM organizations
  WHERE slug = 'small-station-test'
    AND community_id = (SELECT id FROM communities WHERE slug = 'first-responders')
);

-- Create test users and memberships
DO $$
DECLARE
  community_uuid uuid;
  large_org_uuid uuid;
  small_org_uuid uuid;
  user_uuid uuid;
  i integer;
  d integer;
  display_names text[] := ARRAY[
    'BraveEagle42', 'SteadyOak17', 'QuietFalcon88', 'IronWolf33', 'SwiftHawk91',
    'BoldTiger56', 'CalmRiver23', 'StrongBear77', 'WiseOwl64', 'QuickFox45',
    'DarkMood01', 'DecliningSpirit02'
  ];
BEGIN
  -- Get community ID
  SELECT id INTO community_uuid FROM communities WHERE slug = 'first-responders';

  IF community_uuid IS NULL THEN
    RAISE EXCEPTION 'First Responders community not found. Run first-responders.sql first.';
  END IF;

  -- Get org IDs
  SELECT id INTO large_org_uuid FROM organizations WHERE slug = 'test-fire-dept' AND community_id = community_uuid;
  SELECT id INTO small_org_uuid FROM organizations WHERE slug = 'small-station-test' AND community_id = community_uuid;

  IF large_org_uuid IS NULL THEN
    RAISE EXCEPTION 'Test Fire Department org not found';
  END IF;

  -- Create 12 users for large org + 3 for small org
  FOR i IN 1..15 LOOP
    -- Create user (without first_name/last_name as they don't exist in schema)
    INSERT INTO users (id, email, password_hash)
    VALUES (
      gen_random_uuid(),
      'testmood' || i || '@example.com',
      '$2b$10$placeholder' -- Not a real hash, these users can't login
    )
    ON CONFLICT (email) DO NOTHING;

    -- Get user_uuid
    SELECT id INTO user_uuid FROM users WHERE email = 'testmood' || i || '@example.com';

    -- Create membership
    IF i <= 12 THEN
      -- Large org users
      INSERT INTO memberships (user_id, community_id, organization_id, role, display_name, onboarding_completed)
      VALUES (user_uuid, community_uuid, large_org_uuid, 'seeker', display_names[i], true)
      ON CONFLICT (user_id, community_id) DO NOTHING;
    ELSE
      -- Small org users (for privacy threshold testing)
      INSERT INTO memberships (user_id, community_id, organization_id, role, display_name, onboarding_completed)
      VALUES (user_uuid, community_uuid, small_org_uuid, 'seeker', 'SmallOrgUser' || (i-12), true)
      ON CONFLICT (user_id, community_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Clear existing test check-ins
  DELETE FROM mood_checkins
  WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testmood%@example.com');

  -- Generate 30 days of mood check-ins for large org users
  -- Users 1-10: Normal variation (moods 2-5)
  FOR i IN 1..10 LOOP
    SELECT id INTO user_uuid FROM users WHERE email = 'testmood' || i || '@example.com';

    FOR d IN 0..29 LOOP
      -- Skip some days randomly (70% check-in rate)
      IF random() < 0.7 THEN
        INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
        VALUES (
          user_uuid,
          community_uuid,
          large_org_uuid,
          -- Random mood between 2 and 5, weighted toward middle
          CASE
            WHEN random() < 0.15 THEN 2
            WHEN random() < 0.45 THEN 3
            WHEN random() < 0.75 THEN 4
            ELSE 5
          END,
          CASE WHEN random() < 0.7 THEN 'standalone' ELSE 'conversation' END,
          NOW() - (d || ' days')::interval - (floor(random() * 8) || ' hours')::interval
        );
      END IF;
    END LOOP;
  END LOOP;

  -- User 11 (DarkMood01): Consecutive low moods (alert pattern)
  SELECT id INTO user_uuid FROM users WHERE email = 'testmood11@example.com';
  -- Recent 5 days all at mood 1
  FOR d IN 0..4 LOOP
    INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
    VALUES (
      user_uuid,
      community_uuid,
      large_org_uuid,
      1, -- Much Worse
      'standalone',
      NOW() - (d || ' days')::interval - '9 hours'::interval
    );
  END LOOP;
  -- Earlier days were okay
  FOR d IN 5..20 LOOP
    IF random() < 0.6 THEN
      INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
      VALUES (
        user_uuid,
        community_uuid,
        large_org_uuid,
        3 + floor(random() * 2)::int, -- Mood 3-4
        'standalone',
        NOW() - (d || ' days')::interval - '9 hours'::interval
      );
    END IF;
  END LOOP;

  -- User 12 (DecliningSpirit02): Significant decline pattern
  SELECT id INTO user_uuid FROM users WHERE email = 'testmood12@example.com';
  -- Recent 7 days: low moods (avg ~2)
  FOR d IN 0..6 LOOP
    INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
    VALUES (
      user_uuid,
      community_uuid,
      large_org_uuid,
      CASE WHEN random() < 0.7 THEN 2 ELSE 1 END,
      'standalone',
      NOW() - (d || ' days')::interval - '10 hours'::interval
    );
  END LOOP;
  -- Previous 7 days: good moods (avg ~4)
  FOR d IN 7..13 LOOP
    INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
    VALUES (
      user_uuid,
      community_uuid,
      large_org_uuid,
      CASE WHEN random() < 0.6 THEN 4 ELSE 5 END,
      'standalone',
      NOW() - (d || ' days')::interval - '10 hours'::interval
    );
  END LOOP;

  -- Users 13-15 (Small org): Just a few check-ins to test privacy threshold
  FOR i IN 13..15 LOOP
    SELECT id INTO user_uuid FROM users WHERE email = 'testmood' || i || '@example.com';
    FOR d IN 0..5 LOOP
      IF random() < 0.5 THEN
        INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, created_at)
        VALUES (
          user_uuid,
          community_uuid,
          small_org_uuid,
          2 + floor(random() * 3)::int,
          'standalone',
          NOW() - (d || ' days')::interval
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Create a disengaged user pattern for user 10
  -- Delete their recent check-ins to create a 10+ day gap
  SELECT id INTO user_uuid FROM users WHERE email = 'testmood10@example.com';
  DELETE FROM mood_checkins
  WHERE user_id = user_uuid
    AND created_at > NOW() - '10 days'::interval;

  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE 'Large org (test-fire-dept): 12 users with 30 days of data';
  RAISE NOTICE 'Small org (small-station-test): 3 users (below privacy threshold)';
  RAISE NOTICE 'Alert patterns created: consecutive_low (user 11), significant_decline (user 12), disengagement (user 10)';
END $$;

-- Verify counts
SELECT
  o.name as organization,
  COUNT(DISTINCT mc.user_id) as unique_users,
  COUNT(*) as total_checkins,
  AVG(mc.mood_score)::numeric(3,2) as avg_mood
FROM mood_checkins mc
JOIN organizations o ON o.id = mc.organization_id
WHERE mc.community_id = (SELECT id FROM communities WHERE slug = 'first-responders')
  AND o.slug IN ('test-fire-dept', 'small-station-test')
GROUP BY o.name
ORDER BY o.name;
