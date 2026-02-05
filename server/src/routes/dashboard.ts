import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface BadgeCount {
  badge: string;
  count: number;
}

interface HelperStats {
  totalSessions: number;
  activeSessions: number;
  averageRating: number | null;
  totalRatings: number;
  feltHeardPercent: number | null;
  wouldRecommendPercent: number | null;
  totalHelpTime: number;
  recentSessions: RecentSession[];
  averageMoodImprovement: number | null;
  badgeCounts: BadgeCount[];
}

interface RecentSession {
  id: string;
  topic: string | null;
  ended_at: string;
  seeker_rating: number | null;
}

// GET /api/dashboard/:communitySlug/helper - Get helper stats for the current user
router.get('/:communitySlug/helper', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

    // Get total ended sessions as helper
    const totalSessionsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM conversations
       WHERE helper_membership_id = $1 AND community_id = $2 AND status = 'ended'`,
      [membershipId, communityId]
    );
    const totalSessions = parseInt(totalSessionsResult.rows[0].count, 10);

    // Get active sessions as helper
    const activeSessionsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM conversations
       WHERE helper_membership_id = $1 AND community_id = $2 AND status = 'active'`,
      [membershipId, communityId]
    );
    const activeSessions = parseInt(activeSessionsResult.rows[0].count, 10);

    // Get rating stats from seekers who rated conversations with this helper
    const ratingStatsResult = await query<{
      avg_rating: string | null;
      total_ratings: string;
      felt_heard_yes: string;
      felt_heard_total: string;
      would_recommend_yes: string;
      would_recommend_total: string;
    }>(
      `SELECT
        AVG(cr.rating)::numeric(3,2) as avg_rating,
        COUNT(cr.id) as total_ratings,
        COUNT(CASE WHEN cr.felt_heard = true THEN 1 END) as felt_heard_yes,
        COUNT(CASE WHEN cr.felt_heard IS NOT NULL THEN 1 END) as felt_heard_total,
        COUNT(CASE WHEN cr.would_recommend = true THEN 1 END) as would_recommend_yes,
        COUNT(CASE WHEN cr.would_recommend IS NOT NULL THEN 1 END) as would_recommend_total
       FROM conversations c
       JOIN conversation_ratings cr ON cr.conversation_id = c.id
       WHERE c.helper_membership_id = $1
         AND c.community_id = $2
         AND c.status = 'ended'
         AND cr.role = 'seeker'`,
      [membershipId, communityId]
    );

    const stats = ratingStatsResult.rows[0];
    const averageRating = stats.avg_rating ? parseFloat(stats.avg_rating) : null;
    const totalRatings = parseInt(stats.total_ratings, 10);
    const feltHeardTotal = parseInt(stats.felt_heard_total, 10);
    const feltHeardYes = parseInt(stats.felt_heard_yes, 10);
    const wouldRecommendTotal = parseInt(stats.would_recommend_total, 10);
    const wouldRecommendYes = parseInt(stats.would_recommend_yes, 10);

    const feltHeardPercent = feltHeardTotal > 0
      ? Math.round((feltHeardYes / feltHeardTotal) * 100)
      : null;
    const wouldRecommendPercent = wouldRecommendTotal > 0
      ? Math.round((wouldRecommendYes / wouldRecommendTotal) * 100)
      : null;

    // Get total help time in minutes
    const helpTimeResult = await query<{ total_minutes: string | null }>(
      `SELECT EXTRACT(EPOCH FROM SUM(ended_at - started_at)) / 60 as total_minutes
       FROM conversations
       WHERE helper_membership_id = $1 AND community_id = $2 AND status = 'ended'`,
      [membershipId, communityId]
    );
    const totalHelpTime = helpTimeResult.rows[0].total_minutes
      ? Math.round(parseFloat(helpTimeResult.rows[0].total_minutes))
      : 0;

    // Get recent 5 sessions with seeker rating
    const recentSessionsResult = await query<RecentSession>(
      `SELECT
        c.id,
        c.topic,
        c.ended_at,
        cr.rating as seeker_rating
       FROM conversations c
       LEFT JOIN conversation_ratings cr ON cr.conversation_id = c.id AND cr.role = 'seeker'
       WHERE c.helper_membership_id = $1 AND c.community_id = $2 AND c.status = 'ended'
       ORDER BY c.ended_at DESC
       LIMIT 5`,
      [membershipId, communityId]
    );

    // Get average mood improvement
    const moodResult = await query<{ avg_improvement: string | null }>(
      `SELECT AVG(seeker_post_mood - seeker_pre_mood)::numeric(3,1) as avg_improvement
       FROM conversations
       WHERE helper_membership_id = $1
         AND community_id = $2
         AND status = 'ended'
         AND seeker_pre_mood IS NOT NULL
         AND seeker_post_mood IS NOT NULL`,
      [membershipId, communityId]
    );
    const averageMoodImprovement = moodResult.rows[0].avg_improvement
      ? parseFloat(moodResult.rows[0].avg_improvement)
      : null;

    // Get badge counts
    const badgeResult = await query<{ badge: string; count: string }>(
      `SELECT unnest(helper_compliment_badges) as badge, COUNT(*) as count
       FROM conversations
       WHERE helper_membership_id = $1
         AND community_id = $2
         AND status = 'ended'
         AND helper_compliment_badges IS NOT NULL
       GROUP BY badge
       ORDER BY count DESC`,
      [membershipId, communityId]
    );
    const badgeCounts: BadgeCount[] = badgeResult.rows.map((r) => ({
      badge: r.badge,
      count: parseInt(r.count, 10),
    }));

    const helperStats: HelperStats = {
      totalSessions,
      activeSessions,
      averageRating,
      totalRatings,
      feltHeardPercent,
      wouldRecommendPercent,
      totalHelpTime,
      recentSessions: recentSessionsResult.rows,
      averageMoodImprovement,
      badgeCounts,
    };

    res.json(helperStats);
  } catch (error) {
    console.error('Get helper dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
