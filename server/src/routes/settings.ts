import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface NotificationSettingsRow {
  mood_checkin_notifications: boolean | null;
  helper_match_notifications: boolean | null;
}

// GET /api/settings/notifications - Get user's notification preferences
router.get('/notifications', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query<NotificationSettingsRow>(
      `SELECT mood_checkin_notifications, helper_match_notifications FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const settings = result.rows[0];

    res.json({
      moodCheckinNotifications: settings.mood_checkin_notifications ?? true,
      helperMatchNotifications: settings.helper_match_notifications ?? true,
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/notifications - Update user's notification preferences
router.put('/notifications', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { moodCheckinNotifications, helperMatchNotifications } = req.body;

    // Build update query dynamically based on which fields are provided
    const updates: string[] = [];
    const values: (boolean | string)[] = [];
    let paramIndex = 1;

    if (typeof moodCheckinNotifications === 'boolean') {
      updates.push(`mood_checkin_notifications = $${paramIndex}`);
      values.push(moodCheckinNotifications);
      paramIndex++;
    }

    if (typeof helperMatchNotifications === 'boolean') {
      updates.push(`helper_match_notifications = $${paramIndex}`);
      values.push(helperMatchNotifications);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid settings provided' });
      return;
    }

    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Fetch updated settings
    const result = await query<NotificationSettingsRow>(
      `SELECT mood_checkin_notifications, helper_match_notifications FROM users WHERE id = $1`,
      [userId]
    );

    const settings = result.rows[0];

    res.json({
      moodCheckinNotifications: settings.mood_checkin_notifications ?? true,
      helperMatchNotifications: settings.helper_match_notifications ?? true,
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
