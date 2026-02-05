import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface HistoryRow {
  id: string;
  topic: string | null;
  started_at: Date;
  ended_at: Date | null;
  role: 'seeker' | 'helper';
  other_user_email: string | null;
  rating: number | null;
  felt_heard: boolean | null;
  would_recommend: boolean | null;
  seeker_pre_mood: number | null;
  seeker_post_mood: number | null;
  helper_compliment_badges: string[] | null;
  is_saved: boolean;
}

// GET /api/history/:communitySlug - Get past conversations for the current user in a community
router.get('/:communitySlug', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const userId = req.user!.userId;

    // Get community
    const communityResult = await query<{ id: string }>(
      'SELECT id FROM communities WHERE slug = $1',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get user's membership
    const membershipResult = await query<{ id: string }>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'You are not a member of this community' });
      return;
    }

    const membershipId = membershipResult.rows[0].id;

    // Get past conversations with ratings, mood data, badges, and saved status
    const result = await query<HistoryRow>(
      `SELECT
        c.id,
        c.topic,
        c.started_at,
        c.ended_at,
        CASE
          WHEN c.seeker_membership_id = $1 THEN 'seeker'
          ELSE 'helper'
        END as role,
        CASE
          WHEN c.seeker_membership_id = $1 THEN
            CASE
              WHEN c.helper_membership_id IS NULL THEN NULL
              ELSE (SELECT u.email FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.id = c.helper_membership_id)
            END
          ELSE (SELECT u.email FROM users u JOIN memberships m ON m.user_id = u.id WHERE m.id = c.seeker_membership_id)
        END as other_user_email,
        cr.rating,
        cr.felt_heard,
        cr.would_recommend,
        c.seeker_pre_mood,
        c.seeker_post_mood,
        c.helper_compliment_badges,
        CASE
          WHEN $3::uuid = ANY(COALESCE(c.conversation_saved_by, ARRAY[]::uuid[])) THEN true
          ELSE false
        END as is_saved
      FROM conversations c
      LEFT JOIN conversation_ratings cr ON cr.conversation_id = c.id AND cr.membership_id = $1
      WHERE c.community_id = $2
        AND c.status = 'ended'
        AND (c.seeker_membership_id = $1 OR c.helper_membership_id = $1)
      ORDER BY c.ended_at DESC
      LIMIT 50`,
      [membershipId, communityId, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
