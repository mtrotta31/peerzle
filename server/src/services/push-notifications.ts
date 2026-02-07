import webPush, { PushSubscription } from 'web-push';
import { query } from '../config/database';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '../config/vapid';

// Configure web-push with VAPID keys
webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushPayload {
  title: string;
  body: string;
  data?: {
    url?: string;
    type?: string;
    conversationId?: string;
  };
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

/**
 * Delete an invalid/expired push subscription from the database.
 */
async function deleteSubscription(subscriptionId: string): Promise<void> {
  await query('DELETE FROM push_subscriptions WHERE id = $1', [subscriptionId]);
  console.log(`[PUSH] Deleted invalid subscription: ${subscriptionId}`);
}

/**
 * Send a push notification to a single subscription.
 * Returns true if successful, false if failed (subscription may be deleted if expired).
 */
async function sendToSubscription(
  subscription: PushSubscriptionRow,
  payload: PushPayload
): Promise<boolean> {
  const pushSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys_p256dh,
      auth: subscription.keys_auth,
    },
  };

  try {
    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error) {
    const pushError = error as { statusCode?: number };

    // 410 Gone or 404 Not Found means the subscription is no longer valid
    if (pushError.statusCode === 410 || pushError.statusCode === 404) {
      await deleteSubscription(subscription.id);
    } else {
      console.error(`[PUSH] Error sending to ${subscription.endpoint}:`, error);
    }
    return false;
  }
}

/**
 * Send a push notification to all subscriptions for a single user.
 * Handles multiple devices (tabs, phones, etc).
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  const result = await query<PushSubscriptionRow>(
    'SELECT * FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    console.log(`[PUSH] No subscriptions found for user: ${userId}`);
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const subscription of result.rows) {
    const sent = await sendToSubscription(subscription, payload);
    if (sent) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`[PUSH] Sent to user ${userId}: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Send a push notification to multiple users (batch send).
 * Useful for notifying multiple helpers at once.
 */
export async function sendPushToMultipleUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ success: number; failed: number }> {
  if (userIds.length === 0) {
    return { success: 0, failed: 0 };
  }

  // Get all subscriptions for these users
  const result = await query<PushSubscriptionRow>(
    'SELECT * FROM push_subscriptions WHERE user_id = ANY($1)',
    [userIds]
  );

  if (result.rows.length === 0) {
    console.log(`[PUSH] No subscriptions found for ${userIds.length} users`);
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  // Send to all subscriptions in parallel
  const results = await Promise.all(
    result.rows.map((subscription) => sendToSubscription(subscription, payload))
  );

  for (const sent of results) {
    if (sent) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`[PUSH] Batch sent to ${userIds.length} users: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Subscribe a user to push notifications.
 * If the subscription already exists, update it (upsert).
 */
export async function savePushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET keys_p256dh = $3, keys_auth = $4, created_at = NOW()`,
    [userId, endpoint, p256dh, auth]
  );
  console.log(`[PUSH] Saved subscription for user: ${userId}`);
}

/**
 * Remove a push subscription for a user.
 */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint]
  );
  console.log(`[PUSH] Removed subscription for user: ${userId}`);
}

// Rate limiting for new message notifications
// Map of conversationId -> last push timestamp
const messageRateLimits = new Map<string, number>();
const MESSAGE_PUSH_COOLDOWN_MS = 60000; // 60 seconds

/**
 * Check if we should send a push notification for a new message.
 * Rate limited to max 1 push per conversation per 60 seconds.
 */
export function shouldSendMessagePush(conversationId: string): boolean {
  const lastPush = messageRateLimits.get(conversationId);
  const now = Date.now();

  if (lastPush && now - lastPush < MESSAGE_PUSH_COOLDOWN_MS) {
    return false;
  }

  messageRateLimits.set(conversationId, now);
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [conversationId, lastPush] of messageRateLimits.entries()) {
    if (now - lastPush > MESSAGE_PUSH_COOLDOWN_MS * 2) {
      messageRateLimits.delete(conversationId);
    }
  }
}, 60000);
