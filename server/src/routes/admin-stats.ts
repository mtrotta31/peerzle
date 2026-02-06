import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware to verify admin role
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { communitySlug } = req.params;
  const userId = req.user!.userId;

  const result = await query<{ role: string }>(
    `SELECT m.role
     FROM memberships m
     JOIN communities c ON c.id = m.community_id
     WHERE m.user_id = $1 AND c.slug = $2`,
    [userId, communitySlug]
  );

  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// Helper to safely divide and handle division by zero
function safeDivide(numerator: number, denominator: number, asPercentage = false): number | null {
  if (denominator === 0) return asPercentage ? 0 : null;
  const result = numerator / denominator;
  return asPercentage ? Math.round(result * 1000) / 10 : Math.round(result * 100) / 100;
}

// GET /api/admin/stats/:communitySlug - Comprehensive platform statistics
router.get('/:communitySlug', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;

    // Get community ID
    const communityResult = await query<{ id: string }>(
      'SELECT id FROM communities WHERE slug = $1',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get current date references
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Execute all queries in parallel
    const [
      // Usage Metrics
      totalConversationsResult,
      activeHelpersResult,
      totalHelpersResult,
      totalMembersResult,
      conversationsThisWeekResult,
      conversationsThisMonthResult,
      avgDurationResult,
      humanHelperConversationsResult,
      peerbotOnlyResult,
      firstConversationResult,

      // Outcome Metrics
      moodMetricsResult,
      feltHeardResult,
      avgRatingResult,
      totalRatedResult,
      wouldRecommendResult,

      // Safety Metrics
      totalAlertsResult,
      alertsThisMonthResult,
      alertsBySeverityResult,
      totalReportsResult,
      reportsThisMonthResult,

      // Top Topics
      topTopicsResult,

      // Engagement
      uniqueSeekersResult,
      repeatUsersResult,
    ] = await Promise.all([
      // Usage Metrics
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM conversations WHERE community_id = $1',
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships
         WHERE community_id = $1 AND role IN ('helper', 'both', 'admin') AND is_available = true`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships
         WHERE community_id = $1 AND role IN ('helper', 'both', 'admin')`,
        [communityId]
      ),
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM memberships WHERE community_id = $1',
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE community_id = $1 AND started_at >= $2`,
        [communityId, oneWeekAgo]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE community_id = $1 AND started_at >= $2`,
        [communityId, oneMonthAgo]
      ),
      query<{ avg_minutes: string | null }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::numeric(10,1) as avg_minutes
         FROM conversations
         WHERE community_id = $1 AND status = 'ended' AND ended_at IS NOT NULL`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE community_id = $1 AND helper_membership_id IS NOT NULL AND status = 'ended'`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE community_id = $1 AND helper_membership_id IS NULL AND status = 'ended'`,
        [communityId]
      ),
      query<{ first_date: Date | null }>(
        `SELECT MIN(started_at) as first_date FROM conversations WHERE community_id = $1`,
        [communityId]
      ),

      // Outcome Metrics
      query<{ avg_improvement: string | null; total: string; improved: string }>(
        `SELECT
           AVG(seeker_post_mood - seeker_pre_mood)::numeric(3,2) as avg_improvement,
           COUNT(*) FILTER (WHERE seeker_pre_mood IS NOT NULL AND seeker_post_mood IS NOT NULL) as total,
           COUNT(*) FILTER (WHERE seeker_post_mood > seeker_pre_mood) as improved
         FROM conversations
         WHERE community_id = $1`,
        [communityId]
      ),
      query<{ total: string; felt_heard: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE cr.felt_heard = true) as felt_heard
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),
      query<{ avg_rating: string | null }>(
        `SELECT AVG(cr.rating)::numeric(3,2) as avg_rating
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT cr.id) as count
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),
      query<{ total: string; would_recommend: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE cr.would_recommend IS NOT NULL) as total,
           COUNT(*) FILTER (WHERE cr.would_recommend = true) as would_recommend
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),

      // Safety Metrics
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM alert_events WHERE community_id = $1',
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM alert_events
         WHERE community_id = $1 AND created_at >= $2`,
        [communityId, oneMonthAgo]
      ),
      query<{ severity: string; count: string }>(
        `SELECT
           COALESCE(severity, 'medium') as severity,
           COUNT(*) as count
         FROM alert_events
         WHERE community_id = $1
         GROUP BY severity`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_reports ur
         JOIN conversations c ON c.id = ur.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_reports ur
         JOIN conversations c ON c.id = ur.conversation_id
         WHERE c.community_id = $1 AND ur.created_at >= $2`,
        [communityId, oneMonthAgo]
      ),

      // Top Topics
      query<{ topic: string; count: string }>(
        `SELECT topic, COUNT(*) as count
         FROM conversations
         WHERE community_id = $1 AND topic IS NOT NULL AND topic != ''
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 5`,
        [communityId]
      ),

      // Engagement
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT seeker_membership_id) as count
         FROM conversations
         WHERE community_id = $1`,
        [communityId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM (
           SELECT seeker_membership_id
           FROM conversations
           WHERE community_id = $1
           GROUP BY seeker_membership_id
           HAVING COUNT(*) > 1
         ) as repeat_seekers`,
        [communityId]
      ),
    ]);

    // Process results
    const totalConversations = parseInt(totalConversationsResult.rows[0].count, 10);
    const activeHelpers = parseInt(activeHelpersResult.rows[0].count, 10);
    const totalHelpers = parseInt(totalHelpersResult.rows[0].count, 10);
    const totalMembers = parseInt(totalMembersResult.rows[0].count, 10);
    const conversationsThisWeek = parseInt(conversationsThisWeekResult.rows[0].count, 10);
    const conversationsThisMonth = parseInt(conversationsThisMonthResult.rows[0].count, 10);
    const avgDurationMinutes = avgDurationResult.rows[0].avg_minutes
      ? parseFloat(avgDurationResult.rows[0].avg_minutes)
      : null;
    const humanHelperConversations = parseInt(humanHelperConversationsResult.rows[0].count, 10);
    const peerbotOnlyConversations = parseInt(peerbotOnlyResult.rows[0].count, 10);
    const firstConversationDate = firstConversationResult.rows[0].first_date;

    // Mood metrics
    const avgMoodImprovement = moodMetricsResult.rows[0].avg_improvement
      ? parseFloat(moodMetricsResult.rows[0].avg_improvement)
      : null;
    const totalMoodConversations = parseInt(moodMetricsResult.rows[0].total, 10);
    const improvedMoodCount = parseInt(moodMetricsResult.rows[0].improved, 10);
    const pctMoodImproved = safeDivide(improvedMoodCount, totalMoodConversations, true) ?? 0;

    // Felt heard
    const totalRatings = parseInt(feltHeardResult.rows[0].total, 10);
    const feltHeardCount = parseInt(feltHeardResult.rows[0].felt_heard, 10);
    const pctFeltHeard = safeDivide(feltHeardCount, totalRatings, true) ?? 0;

    // Rating
    const avgRating = avgRatingResult.rows[0].avg_rating
      ? parseFloat(avgRatingResult.rows[0].avg_rating)
      : null;
    const totalRatedConversations = parseInt(totalRatedResult.rows[0].count, 10);

    // Would recommend
    const recommendTotal = parseInt(wouldRecommendResult.rows[0].total, 10);
    const wouldRecommendCount = parseInt(wouldRecommendResult.rows[0].would_recommend, 10);
    const pctWouldRecommend = recommendTotal > 0
      ? safeDivide(wouldRecommendCount, recommendTotal, true)
      : null;

    // Safety
    const totalAlerts = parseInt(totalAlertsResult.rows[0].count, 10);
    const alertsThisMonth = parseInt(alertsThisMonthResult.rows[0].count, 10);
    const alertsBySeverity: Record<string, number> = {};
    alertsBySeverityResult.rows.forEach((row) => {
      alertsBySeverity[row.severity] = parseInt(row.count, 10);
    });
    const totalReports = parseInt(totalReportsResult.rows[0].count, 10);
    const reportsThisMonth = parseInt(reportsThisMonthResult.rows[0].count, 10);

    // Top topics
    const topTopics = topTopicsResult.rows.map((row) => ({
      topic: row.topic,
      conversationCount: parseInt(row.count, 10),
    }));

    // Engagement
    const uniqueSeekers = parseInt(uniqueSeekersResult.rows[0].count, 10);
    const repeatUsers = parseInt(repeatUsersResult.rows[0].count, 10);
    const pctRepeatUsers = safeDivide(repeatUsers, uniqueSeekers, true) ?? 0;
    const avgConversationsPerUser = safeDivide(totalConversations, uniqueSeekers);

    res.json({
      // Meta
      firstConversationDate: firstConversationDate ? firstConversationDate.toISOString() : null,

      // Usage Metrics
      usage: {
        totalConversations,
        activeHelpers,
        totalHelpers,
        totalMembers,
        conversationsThisWeek,
        conversationsThisMonth,
        avgConversationDurationMinutes: avgDurationMinutes,
        conversationsWithHumanHelper: humanHelperConversations,
        conversationsPeerbotOnly: peerbotOnlyConversations,
      },

      // Outcome Metrics
      outcomes: {
        avgMoodImprovement,
        pctMoodImproved,
        pctFeltHeard,
        avgRating,
        totalRatedConversations,
        pctWouldRecommend,
      },

      // Safety Metrics
      safety: {
        totalAlerts,
        alertsThisMonth,
        alertsBySeverity,
        totalReports,
        reportsThisMonth,
      },

      // Top Topics
      topTopics,

      // Engagement
      engagement: {
        avgConversationsPerUser,
        repeatUsers,
        pctRepeatUsers,
        uniqueSeekers,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
