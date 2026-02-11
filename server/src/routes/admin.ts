import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware to verify admin role
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
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
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/:communitySlug/overview - Community statistics
router.get('/:communitySlug/overview', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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

    // Get all stats in parallel
    const [
      membersResult,
      conversationsResult,
      activeResult,
      avgRatingResult,
      alertsResult,
      crisisResult,
    ] = await Promise.all([
      // Total members
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM memberships WHERE community_id = $1',
        [communityId]
      ),
      // Total conversations
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM conversations WHERE community_id = $1',
        [communityId]
      ),
      // Active conversations
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations WHERE community_id = $1 AND status = 'active'`,
        [communityId]
      ),
      // Average rating
      query<{ avg_rating: string | null }>(
        `SELECT AVG(cr.rating)::numeric(3,2) as avg_rating
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.community_id = $1`,
        [communityId]
      ),
      // Total safety alerts
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM alert_events WHERE community_id = $1',
        [communityId]
      ),
      // Crisis alerts (severity = 'critical')
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM alert_events WHERE community_id = $1 AND severity = 'critical'`,
        [communityId]
      ),
    ]);

    res.json({
      totalMembers: parseInt(membersResult.rows[0].count, 10),
      totalConversations: parseInt(conversationsResult.rows[0].count, 10),
      activeConversations: parseInt(activeResult.rows[0].count, 10),
      endedConversations: parseInt(conversationsResult.rows[0].count, 10) - parseInt(activeResult.rows[0].count, 10),
      averageRating: avgRatingResult.rows[0].avg_rating ? parseFloat(avgRatingResult.rows[0].avg_rating) : null,
      totalAlerts: parseInt(alertsResult.rows[0].count, 10),
      crisisAlerts: parseInt(crisisResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/:communitySlug/members - List all members with stats
router.get('/:communitySlug/members', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;

    const result = await query<{
      id: string;
      email: string;
      role: string;
      is_available: boolean;
      created_at: Date;
      seeker_conversations: string;
      helper_conversations: string;
      avg_helper_rating: string | null;
    }>(
      `SELECT
        m.id,
        u.email,
        m.role,
        m.is_available,
        m.created_at,
        (SELECT COUNT(*) FROM conversations c WHERE c.seeker_membership_id = m.id)::text as seeker_conversations,
        (SELECT COUNT(*) FROM conversations c WHERE c.helper_membership_id = m.id AND c.status = 'ended')::text as helper_conversations,
        (SELECT AVG(cr.rating)::numeric(3,2)
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.helper_membership_id = m.id AND cr.role = 'seeker')::text as avg_helper_rating
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       JOIN communities cm ON cm.id = m.community_id
       WHERE cm.slug = $1
       ORDER BY m.created_at DESC`,
      [communitySlug]
    );

    const members = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      isAvailable: row.is_available,
      joinedAt: row.created_at,
      seekerConversations: parseInt(row.seeker_conversations, 10),
      helperConversations: parseInt(row.helper_conversations, 10),
      avgHelperRating: row.avg_helper_rating ? parseFloat(row.avg_helper_rating) : null,
    }));

    res.json(members);
  } catch (error) {
    console.error('Admin members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/:communitySlug/alerts - Recent safety alerts
// Query params: ?organization_id=<uuid> to filter by organization
router.get('/:communitySlug/alerts', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const { organization_id: orgId } = req.query;

    // Build query with optional organization filter
    // Include user real name and display name for admin safety context
    let queryText = `
      SELECT ae.id, ae.conversation_id, ae.severity, ae.context, ae.created_at,
             u.first_name, u.last_name, u.email as user_email,
             seeker_m.display_name
      FROM alert_events ae
      JOIN communities c ON c.id = ae.community_id
      JOIN conversations conv ON conv.id = ae.conversation_id
      JOIN memberships seeker_m ON seeker_m.id = conv.seeker_membership_id
      JOIN users u ON u.id = seeker_m.user_id
      WHERE c.slug = $1
    `;
    const queryParams: (string | null)[] = [communitySlug];

    if (orgId && typeof orgId === 'string') {
      queryText += ` AND seeker_m.organization_id = $2`;
      queryParams.push(orgId);
    }

    queryText += ` ORDER BY ae.created_at DESC LIMIT 50`;

    const result = await query<{
      id: string;
      conversation_id: string;
      severity: string;
      context: { risk_level?: string; flags?: string[]; suggested_action?: string; triggering_message?: string };
      created_at: Date;
      first_name: string | null;
      last_name: string | null;
      user_email: string;
      display_name: string | null;
    }>(queryText, queryParams);

    const alerts = result.rows.map((row) => {
      // Build real name if available
      const realName = row.first_name && row.last_name
        ? `${row.first_name} ${row.last_name}`
        : row.first_name || row.last_name || null;

      return {
        id: row.id,
        conversationId: row.conversation_id,
        severity: row.severity,
        riskLevel: row.context?.risk_level || row.severity,
        flags: row.context?.flags || [],
        suggestedAction: row.context?.suggested_action || '',
        excerpt: row.context?.triggering_message || '',
        createdAt: row.created_at,
        // Safety context: real identity for admins
        userRealName: realName,
        userDisplayName: row.display_name,
        userEmail: row.user_email,
      };
    });

    res.json(alerts);
  } catch (error) {
    console.error('Admin alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/:communitySlug/members/:membershipId/role - Update member role
router.put('/:communitySlug/members/:membershipId/role', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, membershipId } = req.params;
    const { role } = req.body;
    const userId = req.user!.userId;

    // Validate role
    const validRoles = ['member', 'helper', 'admin'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be member, helper, or admin' });
      return;
    }

    // Map 'member' to 'seeker' for database (since schema uses 'seeker')
    const dbRole = role === 'member' ? 'seeker' : role;

    // Get the target membership and verify it's in the same community
    const membershipResult = await query<{ user_id: string; community_id: string }>(
      `SELECT m.user_id, m.community_id
       FROM memberships m
       JOIN communities c ON c.id = m.community_id
       WHERE m.id = $1 AND c.slug = $2`,
      [membershipId, communitySlug]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    // Prevent self-demotion
    if (membershipResult.rows[0].user_id === userId && role !== 'admin') {
      res.status(400).json({ error: 'Cannot demote yourself' });
      return;
    }

    // Update the role
    await query(
      'UPDATE memberships SET role = $1 WHERE id = $2',
      [dbRole, membershipId]
    );

    res.json({ success: true, role: dbRole });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
