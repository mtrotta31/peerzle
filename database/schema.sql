-- Peerzle Database Schema
-- Multi-community peer support platform
-- PostgreSQL 15+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Communities: Industry-based peer support networks
-- Examples: First Responders, Healthcare Workers, Veterans
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    -- config structure: {
    --   branding: { primaryColor, logo, ... },
    --   terminology: { helper: "Peer Supporter", seeker: "Member", ... },
    --   topics: ["anxiety", "burnout", "ptsd", ...],
    --   onboarding: { steps, required_fields, ... }
    -- }
    verification_method VARCHAR(50) NOT NULL DEFAULT 'invite_code',
    -- Options: 'invite_code', 'email_domain', 'attestation'
    helper_verification_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_is_active ON communities(is_active);

-- Users: Platform-level accounts
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);

-- Memberships: User's presence in a community
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'seeker',
    -- Options: 'seeker', 'helper', 'both', 'admin'
    is_verified_helper BOOLEAN DEFAULT false,
    profile JSONB DEFAULT '{}',
    -- profile structure: community-specific data (bio, experience, etc.)
    topics JSONB DEFAULT '[]',
    -- topics structure: [{ name: "anxiety", rating: 4 }, ...]
    is_available BOOLEAN DEFAULT false,
    -- Helper availability toggle for matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, community_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_community_id ON memberships(community_id);
CREATE INDEX idx_memberships_role ON memberships(role);
CREATE INDEX idx_memberships_is_available ON memberships(is_available) WHERE is_available = true;
CREATE INDEX idx_memberships_is_verified_helper ON memberships(is_verified_helper) WHERE is_verified_helper = true;

-- Conversations: Peer support sessions between seeker and helper
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    seeker_membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    helper_membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    topic VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'matching',
    -- Options: 'matching', 'active', 'ended'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    seeker_rating INTEGER CHECK (seeker_rating >= 1 AND seeker_rating <= 5),
    helper_rating INTEGER CHECK (helper_rating >= 1 AND helper_rating <= 5),
    safety_flags JSONB DEFAULT '[]'
    -- safety_flags structure: [{ type: "crisis", detected_at: timestamp, ... }]
);

CREATE INDEX idx_conversations_community_id ON conversations(community_id);
CREATE INDEX idx_conversations_seeker_membership_id ON conversations(seeker_membership_id);
CREATE INDEX idx_conversations_helper_membership_id ON conversations(helper_membership_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);

-- Messages: Chat messages within conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    moderation_result JSONB
    -- moderation_result structure: {
    --   flagged: boolean,
    --   categories: [...],
    --   ai_suggested_response: "...",
    --   ...
    -- }
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Organizations: Buyer orgs within communities (e.g., Cincinnati IAFF Local 48 within First Responders)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    logo_url TEXT,
    primary_contact_email VARCHAR(255),
    settings JSONB DEFAULT '{"match_within_org_only": true, "allow_cross_org_matching": false}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, slug)
);

CREATE INDEX idx_organizations_community_id ON organizations(community_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_is_active ON organizations(is_active) WHERE is_active = true;

-- Add organization_id to memberships (defined after organizations table exists)
ALTER TABLE memberships ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_memberships_organization_id ON memberships(organization_id);

-- ============================================================================
-- FUTURE-STATE TABLES (created now, used later)
-- ============================================================================

-- Alert Configurations: How communities want to be notified
CREATE TABLE alert_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    -- Options: 'crisis', 'safety', 'policy_violation'
    destination_type VARCHAR(50) NOT NULL,
    -- Options: 'webhook', 'email', 'sms', 'integration'
    destination_config JSONB NOT NULL,
    -- destination_config structure depends on type:
    -- webhook: { url, secret, headers }
    -- email: { addresses: [...] }
    -- sms: { phone_numbers: [...] }
    -- integration: { provider: "pagerduty"|"slack", ... }
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_configurations_community_id ON alert_configurations(community_id);
CREATE INDEX idx_alert_configurations_alert_type ON alert_configurations(alert_type);
CREATE INDEX idx_alert_configurations_is_active ON alert_configurations(is_active) WHERE is_active = true;

-- Alert Events: Record of triggered alerts
CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- Options: 'medium', 'high', 'critical'
    context JSONB NOT NULL,
    -- context structure: { message_id, trigger_reason, ai_analysis, ... }
    routed_to JSONB DEFAULT '[]',
    -- routed_to structure: [{ destination_type, destination, sent_at, status }]
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_events_community_id ON alert_events(community_id);
CREATE INDEX idx_alert_events_conversation_id ON alert_events(conversation_id);
CREATE INDEX idx_alert_events_alert_type ON alert_events(alert_type);
CREATE INDEX idx_alert_events_severity ON alert_events(severity);
CREATE INDEX idx_alert_events_created_at ON alert_events(created_at DESC);
CREATE INDEX idx_alert_events_unresolved ON alert_events(created_at DESC) WHERE resolved_at IS NULL;

-- Events: Analytics and future ML training data
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    -- Examples: 'user.signup', 'conversation.started', 'message.sent',
    --           'helper.available', 'rating.submitted', etc.
    community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_community_id ON events(community_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_conversation_id ON events(conversation_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Partitioning hint: For production, consider partitioning events table by created_at
-- CREATE TABLE events (...) PARTITION BY RANGE (created_at);
