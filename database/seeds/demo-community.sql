-- Seed: Demo Community
-- Run with: psql $DATABASE_URL -f database/seeds/demo-community.sql

INSERT INTO communities (slug, name, verification_method, helper_verification_required, is_demo, config)
VALUES (
  'demo',
  'Peerzle Demo',
  'open',
  false,
  true,
  '{
    "branding": {
      "primaryColor": "#2B7CF6"
    },
    "terminology": {
      "helper": "Peer Supporter",
      "seeker": "Member",
      "conversation": "Chat Session"
    },
    "topics": [
      "Stress Management",
      "Work-Life Balance",
      "Burnout",
      "General Support",
      "Anxiety",
      "Feeling Overwhelmed"
    ],
    "joinCode": "DEMO"
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  verification_method = EXCLUDED.verification_method,
  helper_verification_required = EXCLUDED.helper_verification_required,
  is_demo = EXCLUDED.is_demo,
  config = EXCLUDED.config;
