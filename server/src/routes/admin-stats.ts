import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware to verify admin role and capture org info
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { communitySlug } = req.params;
  const userId = req.user!.userId;

  const result = await query<{ role: string; organization_id: string | null }>(
    `SELECT m.role, m.organization_id
     FROM memberships m
     JOIN communities c ON c.id = m.community_id
     WHERE m.user_id = $1 AND c.slug = $2`,
    [userId, communitySlug]
  );

  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Store admin's org context
  (req as AuthenticatedRequest & { adminOrgId?: string | null }).adminOrgId = result.rows[0].organization_id;

  next();
}

// Helper to safely divide and handle division by zero
function safeDivide(numerator: number, denominator: number, asPercentage = false): number | null {
  if (denominator === 0) return asPercentage ? 0 : null;
  const result = numerator / denominator;
  return asPercentage ? Math.round(result * 1000) / 10 : Math.round(result * 100) / 100;
}

// GET /api/admin/stats/:communitySlug - Comprehensive platform statistics
// Optional query param: ?organization_id=<uuid> to filter by organization
router.get('/:communitySlug', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const requestedOrgId = req.query.organization_id as string | undefined;
    const adminOrgId = (req as AuthenticatedRequest & { adminOrgId?: string | null }).adminOrgId;

    // If admin is org-scoped and requests a different org, deny
    if (adminOrgId && requestedOrgId && requestedOrgId !== adminOrgId) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    // Effective org filter: org admin always filtered, otherwise use query param
    const organizationId = adminOrgId || requestedOrgId || null;

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

    // Build membership filter for org
    const membershipFilter = organizationId
      ? 'AND m.organization_id = $2'
      : '';
    const membershipParams = organizationId ? [communityId, organizationId] : [communityId];

    // Build conversation filter (seeker must be in org)
    const convMembershipJoin = organizationId
      ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2'
      : '';
    const convParams = organizationId ? [communityId, organizationId] : [communityId];
    const convParamsWithDate = (date: Date) => organizationId ? [communityId, organizationId, date] : [communityId, date];
    const dateParamIndex = organizationId ? '$3' : '$2';

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

      // Organization breakdown (only for community admins)
      orgBreakdownResult,
    ] = await Promise.all([
      // Usage Metrics
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships m
         WHERE m.community_id = $1 AND m.role IN ('helper', 'both', 'admin') AND m.is_available = true ${membershipFilter}`,
        membershipParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships m
         WHERE m.community_id = $1 AND m.role IN ('helper', 'both', 'admin') ${membershipFilter}`,
        membershipParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships m WHERE m.community_id = $1 ${membershipFilter}`,
        membershipParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.started_at >= ${dateParamIndex}`,
        convParamsWithDate(oneWeekAgo)
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.started_at >= ${dateParamIndex}`,
        convParamsWithDate(oneMonthAgo)
      ),
      query<{ avg_minutes: string | null }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (c.ended_at - c.started_at)) / 60)::numeric(10,1) as avg_minutes
         FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.status = 'ended' AND c.ended_at IS NOT NULL`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.helper_membership_id IS NOT NULL AND c.status = 'ended'`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.helper_membership_id IS NULL AND c.status = 'ended'`,
        convParams
      ),
      query<{ first_date: Date | null }>(
        `SELECT MIN(c.started_at) as first_date FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1`,
        convParams
      ),

      // Outcome Metrics
      query<{ avg_improvement: string | null; total: string; improved: string }>(
        `SELECT
           AVG(c.seeker_post_mood - c.seeker_pre_mood)::numeric(3,2) as avg_improvement,
           COUNT(*) FILTER (WHERE c.seeker_pre_mood IS NOT NULL AND c.seeker_post_mood IS NOT NULL) as total,
           COUNT(*) FILTER (WHERE c.seeker_post_mood > c.seeker_pre_mood) as improved
         FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ total: string; felt_heard: string }>(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE cr.felt_heard = true) as felt_heard
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ avg_rating: string | null }>(
        `SELECT AVG(cr.rating)::numeric(3,2) as avg_rating
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT cr.id) as count
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ total: string; would_recommend: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE cr.would_recommend IS NOT NULL) as total,
           COUNT(*) FILTER (WHERE cr.would_recommend = true) as would_recommend
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1`,
        convParams
      ),

      // Safety Metrics (alerts are community-level, filter by conversations involving org members)
      organizationId
        ? query<{ count: string }>(
            `SELECT COUNT(*) as count FROM alert_events ae
             JOIN conversations c ON c.id = ae.conversation_id
             JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2
             WHERE ae.community_id = $1`,
            [communityId, organizationId]
          )
        : query<{ count: string }>(
            'SELECT COUNT(*) as count FROM alert_events WHERE community_id = $1',
            [communityId]
          ),
      organizationId
        ? query<{ count: string }>(
            `SELECT COUNT(*) as count FROM alert_events ae
             JOIN conversations c ON c.id = ae.conversation_id
             JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2
             WHERE ae.community_id = $1 AND ae.created_at >= $3`,
            [communityId, organizationId, oneMonthAgo]
          )
        : query<{ count: string }>(
            `SELECT COUNT(*) as count FROM alert_events
             WHERE community_id = $1 AND created_at >= $2`,
            [communityId, oneMonthAgo]
          ),
      organizationId
        ? query<{ severity: string; count: string }>(
            `SELECT COALESCE(ae.severity, 'medium') as severity, COUNT(*) as count
             FROM alert_events ae
             JOIN conversations c ON c.id = ae.conversation_id
             JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2
             WHERE ae.community_id = $1
             GROUP BY ae.severity`,
            [communityId, organizationId]
          )
        : query<{ severity: string; count: string }>(
            `SELECT COALESCE(severity, 'medium') as severity, COUNT(*) as count
             FROM alert_events WHERE community_id = $1 GROUP BY severity`,
            [communityId]
          ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_reports ur
         JOIN conversations c ON c.id = ur.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_reports ur
         JOIN conversations c ON c.id = ur.conversation_id
         ${organizationId ? 'JOIN memberships sm ON sm.id = c.seeker_membership_id AND sm.organization_id = $2' : ''}
         WHERE c.community_id = $1 AND ur.created_at >= ${dateParamIndex}`,
        convParamsWithDate(oneMonthAgo)
      ),

      // Top Topics
      query<{ topic: string; count: string }>(
        `SELECT c.topic, COUNT(*) as count
         FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1 AND c.topic IS NOT NULL AND c.topic != ''
         GROUP BY c.topic
         ORDER BY count DESC
         LIMIT 5`,
        convParams
      ),

      // Engagement
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT c.seeker_membership_id) as count
         FROM conversations c
         ${convMembershipJoin}
         WHERE c.community_id = $1`,
        convParams
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM (
           SELECT c.seeker_membership_id
           FROM conversations c
           ${convMembershipJoin}
           WHERE c.community_id = $1
           GROUP BY c.seeker_membership_id
           HAVING COUNT(*) > 1
         ) as repeat_seekers`,
        convParams
      ),

      // Organization breakdown (only when not filtering by org)
      organizationId
        ? Promise.resolve({ rows: [] })
        : query<{
            id: string;
            name: string;
            slug: string;
            member_count: string;
            conversation_count: string;
            avg_mood_improvement: string | null;
          }>(
            `SELECT
               o.id, o.name, o.slug,
               (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id) as member_count,
               (SELECT COUNT(*) FROM conversations c JOIN memberships sm ON sm.id = c.seeker_membership_id WHERE sm.organization_id = o.id) as conversation_count,
               (SELECT AVG(c.seeker_post_mood - c.seeker_pre_mood)::numeric(3,2)
                FROM conversations c
                JOIN memberships sm ON sm.id = c.seeker_membership_id
                WHERE sm.organization_id = o.id AND c.seeker_pre_mood IS NOT NULL AND c.seeker_post_mood IS NOT NULL) as avg_mood_improvement
             FROM organizations o
             WHERE o.community_id = $1 AND o.is_active = true
             ORDER BY o.name ASC`,
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

    // Organization breakdown
    const organizationBreakdown = orgBreakdownResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      memberCount: parseInt(row.member_count, 10),
      conversationCount: parseInt(row.conversation_count, 10),
      avgMoodImprovement: row.avg_mood_improvement ? parseFloat(row.avg_mood_improvement) : null,
    }));

    res.json({
      // Meta
      firstConversationDate: firstConversationDate ? firstConversationDate.toISOString() : null,
      organizationId: organizationId || null,

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

      // Organization breakdown (only included for community-level view)
      organizationBreakdown: organizationId ? undefined : organizationBreakdown,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
