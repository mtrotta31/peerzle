import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Minimum users required to show aggregated data (privacy protection)
const PRIVACY_MIN_USERS = 5;

// Middleware to verify admin role and capture org info
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { communitySlug } = req.params;
  const userId = req.user!.userId;

  const result = await query<{ role: string; organization_id: string | null; community_id: string }>(
    `SELECT m.role, m.organization_id, c.id as community_id
     FROM memberships m
     JOIN communities c ON c.id = m.community_id
     WHERE m.user_id = $1 AND c.slug = $2`,
    [userId, communitySlug]
  );

  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  // Store admin's org and community context
  (req as AuthenticatedRequest & { adminOrgId?: string | null; communityId?: string }).adminOrgId = result.rows[0].organization_id;
  (req as AuthenticatedRequest & { adminOrgId?: string | null; communityId?: string }).communityId = result.rows[0].community_id;

  next();
}

// Parse period string to number of days
function parsePeriod(period: string | undefined): number {
  switch (period) {
    case '7d': return 7;
    case '90d': return 90;
    case '30d':
    default: return 30;
  }
}

// Determine trend direction
function getTrend(current: number | null, previous: number | null): 'improving' | 'declining' | 'stable' {
  if (current === null || previous === null) return 'stable';
  const diff = current - previous;
  if (diff > 0.2) return 'improving';
  if (diff < -0.2) return 'declining';
  return 'stable';
}

// GET /api/admin/mood-trends/:communitySlug - Aggregated mood data
router.get('/mood-trends/:communitySlug', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedOrgId = req.query.organization_id as string | undefined;
    const period = parsePeriod(req.query.period as string | undefined);
    const adminOrgId = (req as AuthenticatedRequest & { adminOrgId?: string | null }).adminOrgId;
    const communityId = (req as AuthenticatedRequest & { communityId?: string }).communityId;

    // If admin is org-scoped and requests a different org, deny
    if (adminOrgId && requestedOrgId && requestedOrgId !== adminOrgId) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    // Effective org filter: org admin always filtered, otherwise use query param
    const organizationId = adminOrgId || requestedOrgId || null;

    // Calculate date boundaries
    const now = new Date();
    const periodStart = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - period * 24 * 60 * 60 * 1000);

    // Build org filter clause
    const orgFilter = organizationId ? 'AND mc.organization_id = $3' : '';
    const baseParams = organizationId ? [communityId, periodStart, organizationId] : [communityId, periodStart];
    const prevParams = organizationId ? [communityId, previousPeriodStart, periodStart, organizationId] : [communityId, previousPeriodStart, periodStart];

    // Check privacy threshold: count unique users who checked in
    const uniqueUsersResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT mc.user_id) as count
       FROM mood_checkins mc
       WHERE mc.community_id = $1 AND mc.created_at >= $2 ${orgFilter}`,
      baseParams
    );
    const uniqueUsers = parseInt(uniqueUsersResult.rows[0].count, 10);

    if (uniqueUsers < PRIVACY_MIN_USERS) {
      res.json({
        privacy_limited: true,
        message: 'Not enough data for trends. Minimum 5 users required.',
        unique_users: uniqueUsers,
        minimum_required: PRIVACY_MIN_USERS,
      });
      return;
    }

    // Execute all aggregation queries in parallel
    const [
      currentPeriodResult,
      previousPeriodResult,
      dailyAveragesResult,
      distributionResult,
      topicCorrelationResult,
      totalMembersResult,
      alertCountResult,
    ] = await Promise.all([
      // Current period average
      query<{ avg_mood: string | null; total_checkins: string }>(
        `SELECT AVG(mc.mood_score)::numeric(3,2) as avg_mood, COUNT(*) as total_checkins
         FROM mood_checkins mc
         WHERE mc.community_id = $1 AND mc.created_at >= $2 ${orgFilter}`,
        baseParams
      ),

      // Previous period average (for trend comparison)
      query<{ avg_mood: string | null }>(
        `SELECT AVG(mc.mood_score)::numeric(3,2) as avg_mood
         FROM mood_checkins mc
         WHERE mc.community_id = $1 AND mc.created_at >= $2 AND mc.created_at < $3 ${organizationId ? 'AND mc.organization_id = $4' : ''}`,
        prevParams
      ),

      // Daily averages for chart
      query<{ date: string; avg_mood: string; checkin_count: string }>(
        `SELECT DATE(mc.created_at) as date,
                AVG(mc.mood_score)::numeric(3,2) as avg_mood,
                COUNT(*) as checkin_count
         FROM mood_checkins mc
         WHERE mc.community_id = $1 AND mc.created_at >= $2 ${orgFilter}
         GROUP BY DATE(mc.created_at)
         ORDER BY date DESC`,
        baseParams
      ),

      // Mood distribution
      query<{ mood_score: number; count: string }>(
        `SELECT mc.mood_score, COUNT(*) as count
         FROM mood_checkins mc
         WHERE mc.community_id = $1 AND mc.created_at >= $2 ${orgFilter}
         GROUP BY mc.mood_score
         ORDER BY mc.mood_score`,
        baseParams
      ),

      // Topic correlation (from conversations that have mood data)
      query<{ topic: string; avg_mood: string; volume: string }>(
        `SELECT c.topic, AVG(mc.mood_score)::numeric(3,2) as avg_mood, COUNT(*) as volume
         FROM mood_checkins mc
         JOIN conversations c ON c.seeker_membership_id IN (
           SELECT m.id FROM memberships m WHERE m.user_id = mc.user_id AND m.community_id = mc.community_id
         )
         WHERE mc.community_id = $1
           AND mc.created_at >= $2
           AND mc.source = 'conversation'
           AND c.topic IS NOT NULL
           AND c.topic != ''
           ${orgFilter}
         GROUP BY c.topic
         HAVING COUNT(*) >= 3
         ORDER BY avg_mood ASC
         LIMIT 5`,
        baseParams
      ),

      // Total members for participation rate
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM memberships m
         WHERE m.community_id = $1 ${organizationId ? 'AND m.organization_id = $2' : ''}`,
        organizationId ? [communityId, organizationId] : [communityId]
      ),

      // Count of users with concerning patterns (for critical_alerts)
      query<{ count: string }>(
        `WITH consecutive_low AS (
           SELECT user_id, COUNT(*) as streak
           FROM (
             SELECT user_id, mood_score, created_at,
                    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
             FROM mood_checkins
             WHERE community_id = $1 ${organizationId ? 'AND organization_id = $2' : ''}
           ) ranked
           WHERE rn <= 3 AND mood_score = 1
           GROUP BY user_id
           HAVING COUNT(*) >= 3
         )
         SELECT COUNT(*) as count FROM consecutive_low`,
        organizationId ? [communityId, organizationId] : [communityId]
      ),
    ]);

    // Process results
    const avgMoodCurrent = currentPeriodResult.rows[0].avg_mood
      ? parseFloat(currentPeriodResult.rows[0].avg_mood)
      : null;
    const avgMoodPrevious = previousPeriodResult.rows[0].avg_mood
      ? parseFloat(previousPeriodResult.rows[0].avg_mood)
      : null;
    const totalCheckins = parseInt(currentPeriodResult.rows[0].total_checkins, 10);
    const totalMembers = parseInt(totalMembersResult.rows[0].count, 10);
    const criticalAlerts = parseInt(alertCountResult.rows[0].count, 10);

    // Calculate participation rate
    const participationRate = totalMembers > 0
      ? Math.round((uniqueUsers / totalMembers) * 100) / 100
      : 0;

    // Format daily averages
    const dailyAverages = dailyAveragesResult.rows.map(row => ({
      date: row.date,
      avg_mood: parseFloat(row.avg_mood),
      checkin_count: parseInt(row.checkin_count, 10),
    }));

    // Calculate distribution percentages
    const distributionMap: Record<string, number> = {
      much_worse: 0,
      slightly_down: 0,
      neutral: 0,
      okay: 0,
      good: 0,
    };
    const scoreLabels = ['much_worse', 'slightly_down', 'neutral', 'okay', 'good'];
    distributionResult.rows.forEach(row => {
      const label = scoreLabels[row.mood_score - 1];
      distributionMap[label] = parseInt(row.count, 10);
    });

    // Convert to percentages
    const distributionTotal = Object.values(distributionMap).reduce((a, b) => a + b, 0);
    const distribution: Record<string, number> = {};
    for (const [key, value] of Object.entries(distributionMap)) {
      distribution[key] = distributionTotal > 0
        ? Math.round((value / distributionTotal) * 100) / 100
        : 0;
    }

    // Format topic correlation
    const topicCorrelation = topicCorrelationResult.rows.map(row => ({
      topic: row.topic,
      avg_mood: parseFloat(row.avg_mood),
      volume: parseInt(row.volume, 10),
    }));

    res.json({
      privacy_limited: false,
      summary: {
        avg_mood_current: avgMoodCurrent,
        avg_mood_previous: avgMoodPrevious,
        trend: getTrend(avgMoodCurrent, avgMoodPrevious),
        total_checkins: totalCheckins,
        participation_rate: participationRate,
        critical_alerts: criticalAlerts,
      },
      daily_averages: dailyAverages,
      distribution,
      topic_correlation: topicCorrelation,
    });
  } catch (error) {
    console.error('Admin mood trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/mood-alerts/:communitySlug - Users with concerning patterns
router.get('/mood-alerts/:communitySlug', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedOrgId = req.query.organization_id as string | undefined;
    const adminOrgId = (req as AuthenticatedRequest & { adminOrgId?: string | null }).adminOrgId;
    const communityId = (req as AuthenticatedRequest & { communityId?: string }).communityId;

    // If admin is org-scoped and requests a different org, deny
    if (adminOrgId && requestedOrgId && requestedOrgId !== adminOrgId) {
      res.status(403).json({ error: 'Access denied to this organization' });
      return;
    }

    const organizationId = adminOrgId || requestedOrgId || null;
    const orgFilter = organizationId ? 'AND mc.organization_id = $2' : '';
    const orgFilterMembership = organizationId ? 'AND m.organization_id = $2' : '';
    const params = organizationId ? [communityId, organizationId] : [communityId];

    // Check privacy threshold
    const uniqueUsersResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT mc.user_id) as count
       FROM mood_checkins mc
       WHERE mc.community_id = $1 ${orgFilter}`,
      params
    );
    const uniqueUsers = parseInt(uniqueUsersResult.rows[0].count, 10);

    if (uniqueUsers < PRIVACY_MIN_USERS) {
      res.json({
        privacy_limited: true,
        message: 'Not enough data for alerts. Minimum 5 users required.',
        alerts: [],
      });
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find all concerning patterns in parallel
    const [
      consecutiveLowResult,
      significantDeclineResult,
      disengagementResult,
    ] = await Promise.all([
      // Pattern 1: 3+ consecutive days at mood_score = 1 (Much Worse)
      query<{ user_id: string; display_name: string; consecutive_days: string }>(
        `WITH recent_checkins AS (
           SELECT mc.user_id, DATE(mc.created_at) as checkin_date, mc.mood_score,
                  LAG(DATE(mc.created_at)) OVER (PARTITION BY mc.user_id ORDER BY mc.created_at) as prev_date,
                  LAG(mc.mood_score) OVER (PARTITION BY mc.user_id ORDER BY mc.created_at) as prev_mood
           FROM mood_checkins mc
           WHERE mc.community_id = $1
             AND mc.created_at >= $${organizationId ? '3' : '2'}
             ${orgFilter}
         ),
         streaks AS (
           SELECT user_id,
                  SUM(CASE WHEN mood_score = 1 THEN 1 ELSE 0 END) as low_count
           FROM (
             SELECT user_id, mood_score
             FROM recent_checkins
             WHERE checkin_date >= CURRENT_DATE - INTERVAL '5 days'
             ORDER BY checkin_date DESC
             LIMIT 5
           ) sub
           GROUP BY user_id
           HAVING SUM(CASE WHEN mood_score = 1 THEN 1 ELSE 0 END) >= 3
         )
         SELECT s.user_id, m.display_name, s.low_count as consecutive_days
         FROM streaks s
         JOIN memberships m ON m.user_id = s.user_id AND m.community_id = $1 ${orgFilterMembership}
         ORDER BY s.low_count DESC`,
        organizationId ? [communityId, organizationId, sevenDaysAgo] : [communityId, sevenDaysAgo]
      ),

      // Pattern 2: Significant decline (1.5+ point drop comparing last 7 days to previous 7 days)
      query<{ user_id: string; display_name: string; decline: string }>(
        `WITH user_periods AS (
           SELECT
             mc.user_id,
             AVG(CASE WHEN mc.created_at >= $${organizationId ? '3' : '2'} THEN mc.mood_score END) as recent_avg,
             AVG(CASE WHEN mc.created_at >= $${organizationId ? '4' : '3'} AND mc.created_at < $${organizationId ? '3' : '2'} THEN mc.mood_score END) as previous_avg
           FROM mood_checkins mc
           WHERE mc.community_id = $1 ${orgFilter}
           GROUP BY mc.user_id
           HAVING COUNT(*) FILTER (WHERE mc.created_at >= $${organizationId ? '3' : '2'}) >= 2
              AND COUNT(*) FILTER (WHERE mc.created_at >= $${organizationId ? '4' : '3'} AND mc.created_at < $${organizationId ? '3' : '2'}) >= 2
         )
         SELECT up.user_id, m.display_name,
                (up.previous_avg - up.recent_avg)::numeric(3,2) as decline
         FROM user_periods up
         JOIN memberships m ON m.user_id = up.user_id AND m.community_id = $1 ${orgFilterMembership}
         WHERE up.previous_avg - up.recent_avg >= 1.5
         ORDER BY decline DESC`,
        organizationId
          ? [communityId, organizationId, sevenDaysAgo, fourteenDaysAgo]
          : [communityId, sevenDaysAgo, fourteenDaysAgo]
      ),

      // Pattern 3: Disengagement (no check-in for 7+ days after being active)
      query<{ user_id: string; display_name: string; days_inactive: string }>(
        `WITH user_activity AS (
           SELECT
             mc.user_id,
             MAX(mc.created_at) as last_checkin,
             COUNT(*) as total_checkins
           FROM mood_checkins mc
           WHERE mc.community_id = $1 ${orgFilter}
           GROUP BY mc.user_id
           HAVING COUNT(*) >= 3
         )
         SELECT ua.user_id, m.display_name,
                EXTRACT(DAY FROM NOW() - ua.last_checkin)::integer as days_inactive
         FROM user_activity ua
         JOIN memberships m ON m.user_id = ua.user_id AND m.community_id = $1 ${orgFilterMembership}
         WHERE ua.last_checkin < $${organizationId ? '3' : '2'}
         ORDER BY days_inactive DESC`,
        organizationId ? [communityId, organizationId, sevenDaysAgo] : [communityId, sevenDaysAgo]
      ),
    ]);

    // Combine all alerts
    const alerts: Array<{
      display_name: string;
      alert_type: string;
      days?: number;
      decline?: number;
      days_inactive?: number;
      message: string;
    }> = [];

    // Add consecutive low alerts
    consecutiveLowResult.rows.forEach(row => {
      const days = parseInt(row.consecutive_days, 10);
      alerts.push({
        display_name: row.display_name,
        alert_type: 'consecutive_low',
        days,
        message: `${days} consecutive days at lowest mood level`,
      });
    });

    // Add significant decline alerts
    significantDeclineResult.rows.forEach(row => {
      const decline = parseFloat(row.decline);
      alerts.push({
        display_name: row.display_name,
        alert_type: 'significant_decline',
        decline,
        message: `Mood declined ${decline.toFixed(1)} points over 7 days`,
      });
    });

    // Add disengagement alerts
    disengagementResult.rows.forEach(row => {
      const daysInactive = parseInt(row.days_inactive, 10);
      alerts.push({
        display_name: row.display_name,
        alert_type: 'disengagement',
        days_inactive: daysInactive,
        message: `No check-in for ${daysInactive} days after being active`,
      });
    });

    res.json({
      privacy_limited: false,
      alerts,
    });
  } catch (error) {
    console.error('Admin mood alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
