-- Seed: Epilepsy Community
-- Run with: psql $DATABASE_URL -f database/seeds/epilepsy-community.sql

INSERT INTO communities (slug, name, verification_method, helper_verification_required, is_demo, config)
VALUES (
  'epilepsy',
  'Epilepsy Community',
  'open',
  true,
  false,
  '{
    "branding": {
      "primaryColor": "#7B2D8E"
    },
    "terminology": {
      "helper": "Peer Supporter",
      "seeker": "Member",
      "conversation": "Chat Session"
    },
    "topics": [
      "Seizure Management",
      "Medication Side Effects",
      "Newly Diagnosed",
      "Driving Restrictions",
      "Employment Challenges",
      "Social Stigma",
      "Mental Health",
      "Relationships",
      "Caregiver Support",
      "General Support"
    ]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  verification_method = EXCLUDED.verification_method,
  helper_verification_required = EXCLUDED.helper_verification_required,
  is_demo = EXCLUDED.is_demo,
  config = EXCLUDED.config;
