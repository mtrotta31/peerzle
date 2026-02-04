import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  CURRENT_TOS_VERSION,
  CURRENT_PRIVACY_VERSION,
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
} from '../data/legal-content';

const router = Router();

// GET /api/legal/terms - Get current Terms of Service
router.get('/terms', (_req: Request, res: Response) => {
  res.json({
    version: CURRENT_TOS_VERSION,
    content: TERMS_OF_SERVICE,
  });
});

// GET /api/legal/privacy - Get current Privacy Policy
router.get('/privacy', (_req: Request, res: Response) => {
  res.json({
    version: CURRENT_PRIVACY_VERSION,
    content: PRIVACY_POLICY,
  });
});

// GET /api/legal/acceptance-status - Check if user has accepted current terms
router.get(
  '/acceptance-status',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await query<{ tos_version: string | null; tos_accepted_at: Date | null }>(
        'SELECT tos_version, tos_accepted_at FROM users WHERE id = $1',
        [req.user!.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = result.rows[0];
      const accepted = user.tos_version === CURRENT_TOS_VERSION;

      res.json({
        accepted,
        version: user.tos_version,
        acceptedAt: user.tos_accepted_at,
        currentVersion: CURRENT_TOS_VERSION,
      });
    } catch (error) {
      console.error('Error checking acceptance status:', error);
      res.status(500).json({ error: 'Failed to check acceptance status' });
    }
  }
);

// POST /api/legal/accept - Accept Terms of Service and Privacy Policy
router.post('/accept', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { version } = req.body;

  if (!version) {
    res.status(400).json({ error: 'Version is required' });
    return;
  }

  if (version !== CURRENT_TOS_VERSION) {
    res.status(400).json({ error: 'Invalid version. Please accept the current terms.' });
    return;
  }

  try {
    // Get IP address from request
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    // Update user's TOS acceptance
    await query(
      `UPDATE users
       SET tos_accepted_at = CURRENT_TIMESTAMP, tos_version = $1
       WHERE id = $2`,
      [version, req.user!.userId]
    );

    // Log the acceptance for audit trail
    await query(
      `INSERT INTO tos_acceptance_log (user_id, version, ip_address)
       VALUES ($1, $2, $3)`,
      [req.user!.userId, version, ipAddress]
    );

    res.json({
      success: true,
      message: 'Terms accepted successfully',
      version,
    });
  } catch (error) {
    console.error('Error accepting terms:', error);
    res.status(500).json({ error: 'Failed to accept terms' });
  }
});

export default router;
