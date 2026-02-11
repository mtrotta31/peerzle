import { createHmac } from 'crypto';
import { query } from '../config/database';

// Types
interface WebhookConfig {
  id: string;
  community_id: string;
  organization_id: string | null;
  event_type: string;
  endpoint_url: string;
  secret_key: string;
  is_active: boolean;
  include_pii: boolean;
}

interface AlertData {
  alert_id?: string;
  conversation_id: string;
  severity: string;
  message_excerpt?: string;
  risk_level?: string;
  flags?: string[];
  suggested_action?: string;
}

interface UserData {
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
}

interface WebhookPayload {
  event_type: string;
  timestamp: string;
  community_id: string;
  organization_id: string | null;
  conversation_id: string;
  severity: string;
  message_excerpt?: string;
  alert_id?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
}

// Retry delays in milliseconds: 1s, 4s, 16s
const RETRY_DELAYS = [1000, 4000, 16000];
const MAX_ATTEMPTS = 3;

/**
 * Sign a payload using HMAC-SHA256
 */
function signPayload(payload: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(payload).digest('hex');
}

/**
 * Dispatch webhooks for a specific event
 */
export async function dispatchWebhooks(
  eventType: 'crisis_alert' | 'high_severity_alert' | 'user_report',
  communityId: string,
  organizationId: string | null,
  alertData: AlertData,
  userData?: UserData
): Promise<void> {
  try {
    // Find all matching active webhook configs
    let queryText = `
      SELECT * FROM webhook_configs
      WHERE community_id = $1
        AND event_type = $2
        AND is_active = true
    `;
    const params: (string | null)[] = [communityId, eventType];

    // Include webhooks for:
    // 1. Community-wide webhooks (organization_id IS NULL)
    // 2. Specific org webhooks if organizationId is provided
    if (organizationId) {
      queryText += ` AND (organization_id IS NULL OR organization_id = $3)`;
      params.push(organizationId);
    } else {
      queryText += ` AND organization_id IS NULL`;
    }

    const configsResult = await query<WebhookConfig>(queryText, params);

    if (configsResult.rows.length === 0) {
      console.log(`[WEBHOOK] No active webhooks found for event ${eventType} in community ${communityId}`);
      return;
    }

    console.log(`[WEBHOOK] Found ${configsResult.rows.length} webhook(s) for event ${eventType}`);

    // Dispatch each webhook (fire and forget - use setImmediate to not block)
    for (const config of configsResult.rows) {
      setImmediate(() => {
        deliverWebhook(config, eventType, alertData, userData).catch((err) => {
          console.error(`[WEBHOOK] Delivery error for config ${config.id}:`, err);
        });
      });
    }
  } catch (error) {
    console.error('[WEBHOOK] Dispatch error:', error);
  }
}

/**
 * Deliver a webhook to a specific endpoint with retry logic
 */
async function deliverWebhook(
  config: WebhookConfig,
  eventType: string,
  alertData: AlertData,
  userData?: UserData,
  attemptNumber: number = 1,
  deliveryId?: string
): Promise<void> {
  // Build payload
  const payload: WebhookPayload = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    community_id: config.community_id,
    organization_id: config.organization_id,
    conversation_id: alertData.conversation_id,
    severity: alertData.severity,
    message_excerpt: alertData.message_excerpt,
    alert_id: alertData.alert_id,
  };

  // Include PII if configured
  if (config.include_pii && userData) {
    payload.user_email = userData.user_email;
    payload.user_first_name = userData.user_first_name;
    payload.user_last_name = userData.user_last_name;
  }

  const payloadJson = JSON.stringify(payload);
  const signature = signPayload(payloadJson, config.secret_key);

  // Create or update delivery log
  if (!deliveryId) {
    const insertResult = await query<{ id: string }>(
      `INSERT INTO webhook_deliveries (webhook_config_id, event_type, payload, attempt_number, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [config.id, eventType, payload, attemptNumber]
    );
    deliveryId = insertResult.rows[0].id;
  }

  try {
    console.log(`[WEBHOOK] Delivering to ${config.endpoint_url} (attempt ${attemptNumber})`);

    const response = await fetch(config.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Timestamp': payload.timestamp,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      // Success
      await query(
        `UPDATE webhook_deliveries
         SET status = 'success', response_status = $1, response_body = $2, delivered_at = NOW()
         WHERE id = $3`,
        [response.status, responseBody.substring(0, 1000), deliveryId]
      );
      console.log(`[WEBHOOK] Successfully delivered to ${config.endpoint_url}`);
    } else {
      // HTTP error - retry if attempts remain
      throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WEBHOOK] Delivery failed (attempt ${attemptNumber}):`, errorMessage);

    if (attemptNumber < MAX_ATTEMPTS) {
      // Schedule retry
      const delay = RETRY_DELAYS[attemptNumber - 1] || 16000;
      await query(
        `UPDATE webhook_deliveries
         SET status = 'retrying', attempt_number = $1, error_message = $2
         WHERE id = $3`,
        [attemptNumber, errorMessage, deliveryId]
      );

      console.log(`[WEBHOOK] Scheduling retry in ${delay}ms`);
      setTimeout(() => {
        deliverWebhook(config, eventType, alertData, userData, attemptNumber + 1, deliveryId).catch(
          (err) => {
            console.error(`[WEBHOOK] Retry error:`, err);
          }
        );
      }, delay);
    } else {
      // Max attempts reached
      await query(
        `UPDATE webhook_deliveries
         SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [errorMessage, deliveryId]
      );
      console.error(`[WEBHOOK] Delivery permanently failed after ${MAX_ATTEMPTS} attempts`);
    }
  }
}

/**
 * Send a test webhook to verify endpoint configuration
 */
export async function sendTestWebhook(
  configId: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const configResult = await query<WebhookConfig>(
    'SELECT * FROM webhook_configs WHERE id = $1',
    [configId]
  );

  if (configResult.rows.length === 0) {
    return { success: false, error: 'Webhook configuration not found' };
  }

  const config = configResult.rows[0];

  const testPayload: WebhookPayload = {
    event_type: 'test',
    timestamp: new Date().toISOString(),
    community_id: config.community_id,
    organization_id: config.organization_id,
    conversation_id: '00000000-0000-0000-0000-000000000000',
    severity: 'test',
    message_excerpt: 'This is a test webhook delivery',
    alert_id: '00000000-0000-0000-0000-000000000000',
  };

  if (config.include_pii) {
    testPayload.user_email = 'test@example.com';
    testPayload.user_first_name = 'Test';
    testPayload.user_last_name = 'User';
  }

  const payloadJson = JSON.stringify(testPayload);
  const signature = signPayload(payloadJson, config.secret_key);

  // Log the test delivery
  const deliveryResult = await query<{ id: string }>(
    `INSERT INTO webhook_deliveries (webhook_config_id, event_type, payload, attempt_number, status)
     VALUES ($1, 'test', $2, 1, 'pending')
     RETURNING id`,
    [config.id, testPayload]
  );
  const deliveryId = deliveryResult.rows[0].id;

  try {
    const response = await fetch(config.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'test',
        'X-Webhook-Timestamp': testPayload.timestamp,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(30000),
    });

    const responseBody = await response.text().catch(() => '');

    await query(
      `UPDATE webhook_deliveries
       SET status = $1, response_status = $2, response_body = $3, delivered_at = NOW()
       WHERE id = $4`,
      [response.ok ? 'success' : 'failed', response.status, responseBody.substring(0, 1000), deliveryId]
    );

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      return { success: false, statusCode: response.status, error: responseBody.substring(0, 200) };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await query(
      `UPDATE webhook_deliveries SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errorMessage, deliveryId]
    );
    return { success: false, error: errorMessage };
  }
}

/**
 * Get user data for PII inclusion in webhook payload
 */
export async function getUserDataForWebhook(
  conversationId: string
): Promise<UserData | undefined> {
  const result = await query<{
    email: string;
    first_name: string | null;
    last_name: string | null;
  }>(
    `SELECT u.email, u.first_name, u.last_name
     FROM conversations c
     JOIN memberships m ON m.id = c.seeker_membership_id
     JOIN users u ON u.id = m.user_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  const user = result.rows[0];
  return {
    user_email: user.email,
    user_first_name: user.first_name || undefined,
    user_last_name: user.last_name || undefined,
  };
}

/**
 * Generate a secure random secret key for webhook signing
 */
export function generateSecretKey(): string {
  const { randomBytes } = require('crypto');
  return randomBytes(32).toString('hex');
}
