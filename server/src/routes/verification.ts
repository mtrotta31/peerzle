import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface VerificationRequestRow {
  id: number;
  membership_id: string;
  community_id: string;
  user_id: string;
  qualifications: string;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  created_at: Date;
  user_email?: string;
  reviewer_email?: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
  community_id: string;
  role: string;
  is_verified_helper: boolean;
}

interface CommunityRow {
  id: string;
}

// Middleware to verify admin role
async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { slug } = req.params;
  const userId = req.user!.userId;

  const result = await query<{ role: string }>(
    `SELECT m.role
     FROM memberships m
     JOIN communities c ON c.id = m.community_id
     WHERE m.user_id = $1 AND c.slug = $2`,
    [userId, slug]
  );

  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// POST /api/communities/:slug/verification-request - Submit verification request
router.post('/:slug/verification-request', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { qualifications } = req.body;
    const userId = req.user!.userId;

    if (!qualifications || qualifications.trim().length < 10) {
      res.status(400).json({ error: 'Please provide detailed qualifications (at least 10 characters)' });
      return;
    }

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get membership
    const membershipResult = await query<MembershipRow>(
      'SELECT id, is_verified_helper FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    const membership = membershipResult.rows[0];

    if (membership.is_verified_helper) {
      res.status(400).json({ error: 'You are already a verified specialist' });
      return;
    }

    // Check for existing request
    const existingResult = await query<VerificationRequestRow>(
      'SELECT id, status FROM helper_verification_requests WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'You already have a pending verification request' });
        return;
      }
      // If denied, allow resubmission by updating the existing record
      if (existing.status === 'denied') {
        const updateResult = await query<VerificationRequestRow>(
          `UPDATE helper_verification_requests
           SET qualifications = $1, status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_notes = NULL, created_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [qualifications.trim(), existing.id]
        );
        console.log(`[VERIFICATION] Request resubmitted by user ${userId} in community ${slug}`);
        res.status(201).json(updateResult.rows[0]);
        return;
      }
    }

    // Create new verification request
    const result = await query<VerificationRequestRow>(
      `INSERT INTO helper_verification_requests (membership_id, community_id, user_id, qualifications)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [membership.id, communityId, userId, qualifications.trim()]
    );

    console.log(`[VERIFICATION] Request submitted by user ${userId} in community ${slug}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Submit verification request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/communities/:slug/verification-request - Get user's own verification request
router.get('/:slug/verification-request', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const userId = req.user!.userId;

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get user's verification request
    const result = await query<VerificationRequestRow>(
      `SELECT vr.*, u.email as reviewer_email
       FROM helper_verification_requests vr
       LEFT JOIN users u ON u.id = vr.reviewed_by
       WHERE vr.user_id = $1 AND vr.community_id = $2`,
      [userId, communityId]
    );

    if (result.rows.length === 0) {
      res.json(null);
      return;
    }

    const request = result.rows[0];
    res.json({
      id: request.id,
      membershipId: request.membership_id,
      communityId: request.community_id,
      userId: request.user_id,
      qualifications: request.qualifications,
      status: request.status,
      reviewedBy: request.reviewed_by,
      reviewerEmail: request.reviewer_email,
      reviewedAt: request.reviewed_at,
      reviewNotes: request.review_notes,
      createdAt: request.created_at,
    });
  } catch (error) {
    console.error('Get verification request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/communities/:slug/verification-requests - List all verification requests (admin only)
router.get('/:slug/verification-requests', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get all verification requests with user emails
    const result = await query<VerificationRequestRow>(
      `SELECT vr.*, u.email as user_email, r.email as reviewer_email
       FROM helper_verification_requests vr
       JOIN users u ON u.id = vr.user_id
       LEFT JOIN users r ON r.id = vr.reviewed_by
       WHERE vr.community_id = $1
       ORDER BY
         CASE WHEN vr.status = 'pending' THEN 0 ELSE 1 END,
         vr.created_at DESC`,
      [communityId]
    );

    const requests = result.rows.map((row) => ({
      id: row.id,
      membershipId: row.membership_id,
      communityId: row.community_id,
      userId: row.user_id,
      userEmail: row.user_email,
      qualifications: row.qualifications,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewerEmail: row.reviewer_email,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
    }));

    res.json(requests);
  } catch (error) {
    console.error('List verification requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/communities/:slug/verification-requests/:requestId - Review verification request (admin only)
router.put('/:slug/verification-requests/:requestId', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug, requestId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user!.userId;

    if (!status || !['approved', 'denied'].includes(status)) {
      res.status(400).json({ error: 'Status must be "approved" or "denied"' });
      return;
    }

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get the verification request
    const requestResult = await query<VerificationRequestRow>(
      'SELECT * FROM helper_verification_requests WHERE id = $1 AND community_id = $2',
      [requestId, communityId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Verification request not found' });
      return;
    }

    const verificationRequest = requestResult.rows[0];

    if (verificationRequest.status !== 'pending') {
      res.status(400).json({ error: 'This request has already been reviewed' });
      return;
    }

    // Update the verification request
    const updateResult = await query<VerificationRequestRow>(
      `UPDATE helper_verification_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
       WHERE id = $4
       RETURNING *`,
      [status, reviewerId, reviewNotes || null, requestId]
    );

    // If approved, update the membership
    if (status === 'approved') {
      await query(
        'UPDATE memberships SET is_verified_helper = true WHERE id = $1',
        [verificationRequest.membership_id]
      );
      console.log(`[VERIFICATION] User ${verificationRequest.user_id} approved as verified specialist in community ${slug}`);
    } else {
      console.log(`[VERIFICATION] User ${verificationRequest.user_id} denied verification in community ${slug}`);
    }

    const updated = updateResult.rows[0];
    res.json({
      id: updated.id,
      membershipId: updated.membership_id,
      communityId: updated.community_id,
      userId: updated.user_id,
      qualifications: updated.qualifications,
      status: updated.status,
      reviewedBy: updated.reviewed_by,
      reviewedAt: updated.reviewed_at,
      reviewNotes: updated.review_notes,
      createdAt: updated.created_at,
    });
  } catch (error) {
    console.error('Review verification request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
