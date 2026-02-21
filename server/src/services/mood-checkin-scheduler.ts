import { query } from '../config/database';
import { sendPushNotification } from './push-notifications';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
const DEFAULT_NOTIFICATION_HOUR = 14; // 14:00 UTC = ~11 AM EST / 10 AM EDT

interface UserToNotify {
  user_id: string;
  email: string;
}

/**
 * Start the daily mood check-in notification scheduler.
 * Runs every 15 minutes and sends notifications to users who:
 * - Have mood_checkin_notifications enabled
 * - Have an active push subscription
 * - Haven't checked in today
 * - Haven't been notified today
 */
export function startMoodCheckinScheduler(): void {
  console.log('[MOOD-SCHEDULER] Starting daily mood check-in scheduler');

  // Run immediately on startup, then on interval
  runSchedulerCheck();
  setInterval(runSchedulerCheck, CHECK_INTERVAL_MS);
}

async function runSchedulerCheck(): Promise<void> {
  try {
    const currentHour = new Date().getHours();

    // Only send notifications during the notification window (14:00 - 15:00 UTC = ~11 AM EST)
    // This is a simplified approach - in production, you'd want timezone awareness
    if (currentHour < DEFAULT_NOTIFICATION_HOUR || currentHour >= DEFAULT_NOTIFICATION_HOUR + 1) {
      return;
    }

    console.log('[MOOD-SCHEDULER] Running scheduler check...');

    // Find users who should receive a notification:
    // - Have push subscriptions (means they can receive notifications)
    // - Have mood_checkin_notifications enabled (or null = default true)
    // - Haven't checked in today (no entry in mood_checkins for today)
    // - Haven't been notified today (no entry in mood_checkin_notification_log for today)
    const usersToNotify = await query<UserToNotify>(
      `SELECT DISTINCT u.id as user_id, u.email
       FROM users u
       JOIN push_subscriptions ps ON ps.user_id = u.id
       LEFT JOIN mood_checkin_notification_log nl ON nl.user_id = u.id AND nl.last_sent_date = CURRENT_DATE
       LEFT JOIN mood_checkins mc ON mc.user_id = u.id AND DATE(mc.created_at) = CURRENT_DATE
       WHERE (u.mood_checkin_notifications IS NULL OR u.mood_checkin_notifications = true)
         AND nl.user_id IS NULL
         AND mc.id IS NULL
       LIMIT 100` // Process in batches to avoid overwhelming the system
    );

    if (usersToNotify.rows.length === 0) {
      console.log('[MOOD-SCHEDULER] No users to notify');
      return;
    }

    console.log(`[MOOD-SCHEDULER] Sending notifications to ${usersToNotify.rows.length} users`);

    // Send notifications and log them
    for (const user of usersToNotify.rows) {
      try {
        await sendMoodCheckinReminder(user.user_id);
        await logNotificationSent(user.user_id);
      } catch (error) {
        console.error(`[MOOD-SCHEDULER] Failed to notify user ${user.user_id}:`, error);
        // Continue with other users
      }
    }

    console.log('[MOOD-SCHEDULER] Scheduler check complete');
  } catch (error) {
    console.error('[MOOD-SCHEDULER] Scheduler check failed:', error);
  }
}

async function sendMoodCheckinReminder(userId: string): Promise<void> {
  await sendPushNotification(userId, {
    title: 'Peerzle',
    body: 'How are you feeling today? Quick 10-second check-in 💙',
    data: {
      type: 'mood_checkin_reminder',
      url: '/mood-checkin',
    },
  });
}

async function logNotificationSent(userId: string): Promise<void> {
  await query(
    `INSERT INTO mood_checkin_notification_log (user_id, last_sent_date, updated_at)
     VALUES ($1, CURRENT_DATE, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET last_sent_date = CURRENT_DATE, updated_at = NOW()`,
    [userId]
  );
}

/**
 * Manually trigger a mood check-in reminder for a specific user.
 * Useful for testing or admin-triggered notifications.
 */
export async function sendManualMoodReminder(userId: string): Promise<boolean> {
  try {
    await sendMoodCheckinReminder(userId);
    return true;
  } catch (error) {
    console.error(`[MOOD-SCHEDULER] Failed to send manual reminder to ${userId}:`, error);
    return false;
  }
}
