-- Migration 013: Organizations Layer
-- Organizations are buyers (e.g., Cincinnati IAFF Local 48) that exist within communities (e.g., First Responders)
-- Members belong to an organization, and matching/stats can be filtered by organization

-- 1. Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    logo_url TEXT,
    primary_contact_email VARCHAR(255),
    settings JSONB DEFAULT '{"match_within_org_only": true, "allow_cross_org_matching": false}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, slug)
);

CREATE INDEX idx_organizations_community_id ON organizations(community_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_is_active ON organizations(is_active) WHERE is_active = true;

-- 2. Add organization_id to memberships
ALTER TABLE memberships ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_memberships_organization_id ON memberships(organization_id);

-- 3. Add organization_id to invite_codes
-- When an invite code has an organization_id, joining via that code auto-assigns the user to that organization
ALTER TABLE invite_codes ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_invite_codes_organization_id ON invite_codes(organization_id);

-- 4. Seed default organization for existing First Responders community
INSERT INTO organizations (community_id, name, slug, primary_contact_email, settings)
SELECT id, 'First Responder Peer Support', 'first-responder-default', 'matthew@peerzle.com',
'{"match_within_org_only": false, "allow_cross_org_matching": true}'::jsonb
FROM communities WHERE slug = 'first-responders'
ON CONFLICT DO NOTHING;

-- 5. Backfill existing memberships to the default organization
-- Note: Do NOT backfill admin users - they should remain community-level admins with NULL organization_id
UPDATE memberships
SET organization_id = (SELECT id FROM organizations WHERE slug = 'first-responder-default')
WHERE community_id = (SELECT id FROM communities WHERE slug = 'first-responders')
  AND organization_id IS NULL
  AND role != 'admin';
