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

const VALID_CATEGORIES = ['inappropriate_behavior', 'harmful_content', 'spam', 'crisis_concerns', 'other'];

// POST /api/reports/:conversationId - Submit a report
router.post('/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { category, description } = req.body;
    const userId = req.user!.userId;

    // Validate category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }

    // Get conversation details and verify the reporter is a participant
    const conversationResult = await query<{
      id: string;
      community_id: string;
      seeker_membership_id: string;
      helper_membership_id: string | null;
    }>(
      'SELECT id, community_id, seeker_membership_id, helper_membership_id FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = conversationResult.rows[0];

    // Get reporter's membership in this community
    const membershipResult = await query<{ id: string }>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, conversation.community_id]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this community' });
      return;
    }

    const reporterMembershipId = membershipResult.rows[0].id;

    // Verify reporter is a participant
    if (
      reporterMembershipId !== conversation.seeker_membership_id &&
      reporterMembershipId !== conversation.helper_membership_id
    ) {
      res.status(403).json({ error: 'You are not a participant in this conversation' });
      return;
    }

    // Determine the reported user (the other participant)
    let reportedMembershipId: string | null = null;
    if (reporterMembershipId === conversation.seeker_membership_id) {
      reportedMembershipId = conversation.helper_membership_id;
    } else {
      reportedMembershipId = conversation.seeker_membership_id;
    }

    if (!reportedMembershipId) {
      res.status(400).json({ error: 'No other participant to report' });
      return;
    }

    // Check for duplicate report on same conversation by same user
    const existingReport = await query<{ id: number }>(
      'SELECT id FROM user_reports WHERE conversation_id = $1 AND reporter_membership_id = $2',
      [conversationId, reporterMembershipId]
    );

    if (existingReport.rows.length > 0) {
      res.status(409).json({ error: 'You have already submitted a report for this conversation' });
      return;
    }

    // Create the report
    const reportResult = await query<{ id: number; created_at: Date }>(
      `INSERT INTO user_reports
       (conversation_id, reporter_membership_id, reported_membership_id, community_id, category, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [conversationId, reporterMembershipId, reportedMembershipId, conversation.community_id, category, description || null]
    );

    res.status(201).json({
      id: reportResult.rows[0].id,
      conversationId,
      category,
      description: description || null,
      status: 'pending',
      createdAt: reportResult.rows[0].created_at,
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /api/reports/:communitySlug/list - Get all reports for a community (admin)
// Query params: ?organization_id=<uuid> to filter by organization
router.get('/:communitySlug/list', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const { organization_id: orgId } = req.query;

    // Build query with optional organization filter
    let queryText = `
      SELECT
        ur.id,
        ur.conversation_id,
        reporter_u.email as reporter_email,
        reported_u.email as reported_email,
        ur.category,
        ur.description,
        ur.status,
        ur.admin_notes,
        reviewer_u.email as reviewer_email,
        ur.reviewed_at,
        ur.created_at,
        conv.topic as conversation_topic
       FROM user_reports ur
       JOIN communities c ON c.id = ur.community_id
       JOIN memberships reporter_m ON reporter_m.id = ur.reporter_membership_id
       JOIN users reporter_u ON reporter_u.id = reporter_m.user_id
       JOIN memberships reported_m ON reported_m.id = ur.reported_membership_id
       JOIN users reported_u ON reported_u.id = reported_m.user_id
       JOIN conversations conv ON conv.id = ur.conversation_id
       LEFT JOIN users reviewer_u ON reviewer_u.id = ur.reviewed_by
       WHERE c.slug = $1
    `;
    const queryParams: (string | null)[] = [communitySlug];

    if (orgId && typeof orgId === 'string') {
      // Filter where reporter OR reported belongs to this org
      queryText += ` AND (reporter_m.organization_id = $2 OR reported_m.organization_id = $2)`;
      queryParams.push(orgId);
    }

    queryText += ` ORDER BY ur.created_at DESC LIMIT 50`;

    const result = await query<{
      id: number;
      conversation_id: string;
      reporter_email: string;
      reported_email: string;
      category: string;
      description: string | null;
      status: string;
      admin_notes: string | null;
      reviewer_email: string | null;
      reviewed_at: Date | null;
      created_at: Date;
      conversation_topic: string | null;
    }>(queryText, queryParams);

    const reports = result.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      reporterEmail: row.reporter_email,
      reportedEmail: row.reported_email,
      category: row.category,
      description: row.description,
      status: row.status,
      adminNotes: row.admin_notes,
      reviewerEmail: row.reviewer_email,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      conversationTopic: row.conversation_topic,
    }));

    res.json(reports);
  } catch (error) {
    console.error('Error getting reports:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

// PUT /api/reports/:communitySlug/:reportId - Update report status (admin)
router.put('/:communitySlug/:reportId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId, communitySlug } = req.params;
    const { status, adminNotes } = req.body;
    const userId = req.user!.userId;

    // Validate status
    if (!status || !['reviewed', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Status must be "reviewed" or "dismissed"' });
      return;
    }

    // Verify the report belongs to this community
    const reportCheck = await query<{ id: number }>(
      `SELECT ur.id
       FROM user_reports ur
       JOIN communities c ON c.id = ur.community_id
       WHERE ur.id = $1 AND c.slug = $2`,
      [reportId, communitySlug]
    );

    if (reportCheck.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Update the report
    const result = await query<{
      id: number;
      status: string;
      admin_notes: string | null;
      reviewed_at: Date;
    }>(
      `UPDATE user_reports
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING id, status, admin_notes, reviewed_at`,
      [status, adminNotes || null, userId, reportId]
    );

    res.json({
      id: result.rows[0].id,
      status: result.rows[0].status,
      adminNotes: result.rows[0].admin_notes,
      reviewedAt: result.rows[0].reviewed_at,
    });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

export default router;
