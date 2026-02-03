-- Seed: First Responders Community
-- Run with: psql $DATABASE_URL -f database/seeds/first-responders.sql

INSERT INTO communities (slug, name, verification_method, helper_verification_required, config)
VALUES (
  'first-responders',
  'First Responder Peer Support',
  'invite_code',
  true,
  '{
    "branding": {
      "primaryColor": "#1a365d",
      "secondaryColor": "#c53030"
    },
    "terminology": {
      "helper": "Peer Support Specialist",
      "seeker": "Member",
      "conversation": "Support Session"
    },
    "topics": [
      "Critical Incident Stress",
      "PTSD & Trauma",
      "Work-Life Balance",
      "Relationship Challenges",
      "Substance Use",
      "LODD Grief",
      "Career Transition",
      "General Support"
    ]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  verification_method = EXCLUDED.verification_method,
  helper_verification_required = EXCLUDED.helper_verification_required,
  config = EXCLUDED.config;
