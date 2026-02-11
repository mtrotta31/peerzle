-- Migration 016: Webhooks for Crisis Alerts
-- External notification system for safety alerts and crisis events

-- 1. Create webhook_configs table
CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  endpoint_url TEXT NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  include_pii BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('crisis_alert', 'high_severity_alert', 'user_report'))
);

COMMENT ON TABLE webhook_configs IS 'Webhook endpoint configurations for external notifications';
COMMENT ON COLUMN webhook_configs.organization_id IS 'Optional - if NULL, applies to entire community';
COMMENT ON COLUMN webhook_configs.event_type IS 'Type of event that triggers this webhook';
COMMENT ON COLUMN webhook_configs.secret_key IS 'HMAC-SHA256 signing key for webhook payloads';
COMMENT ON COLUMN webhook_configs.include_pii IS 'If true, include user email/name in payload';

-- 2. Create webhook_deliveries table (delivery log)
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_delivery_status CHECK (status IN ('pending', 'success', 'failed', 'retrying'))
);

COMMENT ON TABLE webhook_deliveries IS 'Log of webhook delivery attempts';
COMMENT ON COLUMN webhook_deliveries.attempt_number IS 'Number of delivery attempts (max 3)';
COMMENT ON COLUMN webhook_deliveries.status IS 'Current delivery status';

-- 3. Create indexes for efficient lookups
CREATE INDEX idx_webhook_configs_community ON webhook_configs(community_id);
CREATE INDEX idx_webhook_configs_organization ON webhook_configs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_webhook_configs_event_type ON webhook_configs(event_type);
CREATE INDEX idx_webhook_configs_active ON webhook_configs(is_active) WHERE is_active = true;

CREATE INDEX idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC);
