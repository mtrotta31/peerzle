import { query } from '../config/database';
import { sendPushNotification } from './push-notifications';

const NUDGE_COOLDOWN_DAYS = 7; // Don't send another nudge for 7 days after one was sent

/**
 * Check if user has 3 consecutive "Much Worse" (score=1) mood check-ins
 * and trigger a PeerBot nudge if so.
 */
export async function checkAndTriggerMoodNudge(
  userId: string,
  communityId: string
): Promise<void> {
  try {
    // Get last 3 check-ins for this user in this community
    const checkinsResult = await query(
      `SELECT mood_score, DATE(created_at) as check_date
       FROM mood_checkins
       WHERE user_id = $1 AND community_id = $2
       ORDER BY created_at DESC
       LIMIT 3`,
      [userId, communityId]
    );

    // Need at least 3 check-ins
    if (checkinsResult.rows.length < 3) {
      return;
    }

    // Check if all 3 are "Much Worse" (score=1)
    const allMuchWorse = checkinsResult.rows.every(row => row.mood_score === 1);
    if (!allMuchWorse) {
      return;
    }

    // Check if they're on consecutive days
    const dates = checkinsResult.rows.map(row => new Date(row.check_date));
    const isConsecutive = areConsecutiveDays(dates);
    if (!isConsecutive) {
      return;
    }

    // Check if we already sent a nudge recently
    const recentNudgeResult = await query(
      `SELECT 1 FROM mood_nudge_log
       WHERE user_id = $1 AND community_id = $2
         AND sent_at > NOW() - INTERVAL '${NUDGE_COOLDOWN_DAYS} days'
       LIMIT 1`,
      [userId, communityId]
    );

    if (recentNudgeResult.rows.length > 0) {
      console.log(`[MOOD-NUDGE] Skipping nudge for user ${userId} - sent recently`);
      return;
    }

    // Send the nudge!
    await sendMoodNudge(userId, communityId);

  } catch (error) {
    console.error('[MOOD-NUDGE] Error checking mood nudge:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Check if an array of dates (sorted descending) represents consecutive days.
 */
function areConsecutiveDays(dates: Date[]): boolean {
  for (let i = 0; i < dates.length - 1; i++) {
    const current = dates[i];
    const next = dates[i + 1];

    // Calculate difference in days
    const diffTime = current.getTime() - next.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays !== 1) {
      return false;
    }
  }
  return true;
}

/**
 * Send a PeerBot nudge to user via push notification.
 */
async function sendMoodNudge(userId: string, communityId: string): Promise<void> {
  console.log(`[MOOD-NUDGE] Sending nudge to user ${userId} in community ${communityId}`);

  // Log the nudge
  await query(
    `INSERT INTO mood_nudge_log (user_id, community_id, nudge_type, sent_at)
     VALUES ($1, $2, 'consecutive_low', NOW())`,
    [userId, communityId]
  );

  // Get community name for the notification
  const communityResult = await query(
    `SELECT name, slug FROM communities WHERE id = $1`,
    [communityId]
  );

  const communitySlug = communityResult.rows[0]?.slug || '';

  // Send push notification
  await sendPushNotification(userId, {
    title: 'Peerzle',
    body: "Hey — you've been having a tough stretch. No pressure, but if you want to talk to someone who gets it, I can help you connect. 💙",
    data: {
      type: 'mood_nudge',
      url: `/community/${communitySlug}`,
    },
  });

  console.log(`[MOOD-NUDGE] Nudge sent successfully to user ${userId}`);
}
