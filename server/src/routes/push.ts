import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/database';
import {
  savePushSubscription,
  removePushSubscription,
  sendPushNotification,
} from '../services/push-notifications';
import { VAPID_PUBLIC_KEY } from '../config/vapid';

const router = Router();

// GET /api/push/vapid-public-key - Get the VAPID public key for client subscription
router.get('/vapid-public-key', (_req, res: Response) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe - Subscribe to push notifications
router.post('/subscribe', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription data' });
      return;
    }

    await savePushSubscription(userId, endpoint, keys.p256dh, keys.auth);

    res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/push/unsubscribe - Unsubscribe from push notifications
router.delete('/unsubscribe', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    await removePushSubscription(userId, endpoint);

    res.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/push/test - Send a test notification (admin only)
router.post('/test', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check if user is an admin in any community
    const adminCheck = await query(
      `SELECT 1 FROM memberships WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
      [userId]
    );

    if (adminCheck.rows.length === 0) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const result = await sendPushNotification(userId, {
      title: 'Peerzle',
      body: 'Push notifications are working!',
      data: { type: 'test' },
    });

    if (result.success === 0 && result.failed === 0) {
      res.json({ success: false, message: 'No push subscriptions found for your account' });
      return;
    }

    res.json({
      success: true,
      message: `Sent ${result.success} notification(s), ${result.failed} failed`,
    });
  } catch (error) {
    console.error('Push test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/push/test-user - Send a test notification (any authenticated user)
router.post('/test-user', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await sendPushNotification(userId, {
      title: 'Peerzle',
      body: 'Push notifications are working!',
      data: { type: 'test' },
    });

    if (result.success === 0 && result.failed === 0) {
      res.json({ success: false, message: 'No push subscriptions found. Enable notifications in your browser first.' });
      return;
    }

    res.json({
      success: true,
      message: `Test notification sent successfully`,
    });
  } catch (error) {
    console.error('Push test-user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
