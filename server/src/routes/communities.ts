import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

interface CommunityRow {
  id: string;
  slug: string;
  name: string;
  config: Record<string, unknown>;
  verification_method: string;
  allowed_email_domains: string[];
  is_public: boolean;
  helper_verification_required: boolean;
  is_active: boolean;
  created_at: Date;
}

interface MembershipRow {
  id: string;
  user_id: string;
  community_id: string;
  role: string;
  is_verified_helper: boolean;
  training_completed: boolean;
  profile: Record<string, unknown>;
  topics: unknown[];
  is_available: boolean;
  created_at: Date;
}

interface InviteCodeRow {
  id: number;
  community_id: string;
  organization_id: string | null;
  code: string;
  created_by: string;
  max_uses: number | null;
  current_uses: number;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  creator_email?: string;
}

// Generate a random 8-character alphanumeric code
function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/communities - List all active communities
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<CommunityRow>(
      `SELECT id, slug, name, config, verification_method, allowed_email_domains, is_public, helper_verification_required, created_at
       FROM communities
       WHERE is_active = true
       ORDER BY name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List communities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/communities/:slug - Get single community by slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await query<CommunityRow>(
      `SELECT id, slug, name, config, verification_method, allowed_email_domains, is_public, helper_verification_required, created_at
       FROM communities
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/communities/:slug/join - Join a community with verification
router.post('/:slug/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { inviteCode } = req.body;
    const userId = req.user!.userId;
    const userEmail = req.user!.email;

    // Get community with verification settings
    const communityResult = await query<CommunityRow>(
      `SELECT id, verification_method, allowed_email_domains
       FROM communities
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const community = communityResult.rows[0];

    // Check if already a member
    const existingMembership = await query<MembershipRow>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, community.id]
    );

    if (existingMembership.rows.length > 0) {
      res.status(409).json({ error: 'Already a member of this community' });
      return;
    }

    // Track organization_id from invite code (if any)
    let organizationId: string | null = null;

    // Verify based on verification method
    if (community.verification_method === 'invite_code') {
      if (!inviteCode) {
        res.status(403).json({
          error: 'Invite code required',
          reason: 'invite_code_required'
        });
        return;
      }

      // Validate invite code
      const codeResult = await query<InviteCodeRow>(
        `SELECT id, max_uses, current_uses, expires_at, is_active, organization_id
         FROM invite_codes
         WHERE code = $1 AND community_id = $2`,
        [inviteCode.toUpperCase(), community.id]
      );

      if (codeResult.rows.length === 0) {
        res.status(403).json({
          error: 'Invalid invite code',
          reason: 'invalid_code'
        });
        return;
      }

      const code = codeResult.rows[0];

      if (!code.is_active) {
        res.status(403).json({
          error: 'This invite code has been deactivated',
          reason: 'code_inactive'
        });
        return;
      }

      if (code.expires_at && new Date(code.expires_at) < new Date()) {
        res.status(403).json({
          error: 'This invite code has expired',
          reason: 'code_expired'
        });
        return;
      }

      if (code.max_uses !== null && code.current_uses >= code.max_uses) {
        res.status(403).json({
          error: 'This invite code has reached its maximum uses',
          reason: 'code_max_uses'
        });
        return;
      }

      // Capture organization_id from invite code for membership creation
      organizationId = code.organization_id;

      // Increment code usage
      await query(
        'UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = $1',
        [code.id]
      );

    } else if (community.verification_method === 'email_domain') {
      const allowedDomains = community.allowed_email_domains || [];

      if (allowedDomains.length === 0) {
        res.status(403).json({
          error: 'No email domains configured for this community',
          reason: 'no_domains_configured'
        });
        return;
      }

      const emailDomain = '@' + userEmail.split('@')[1].toLowerCase();
      const isAllowed = allowedDomains.some(
        domain => emailDomain.toLowerCase().endsWith(domain.toLowerCase())
      );

      if (!isAllowed) {
        res.status(403).json({
          error: 'Your email domain is not authorized for this community',
          reason: 'email_domain_not_allowed',
          allowedDomains: allowedDomains
        });
        return;
      }
    }
    // If verification_method === 'open', no additional verification needed

    // Create membership with optional organization_id
    const result = await query<MembershipRow & { organization_id: string | null }>(
      `INSERT INTO memberships (user_id, community_id, role, organization_id)
       VALUES ($1, $2, 'seeker', $3)
       RETURNING id, user_id, community_id, role, is_verified_helper, profile, topics, is_available, created_at, organization_id`,
      [userId, community.id, organizationId]
    );

    console.log(`[JOIN] User ${userId} joined community ${slug} via ${community.verification_method}${organizationId ? ` (org: ${organizationId})` : ''}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/communities/:slug/membership - Get current user's membership
router.get('/:slug/membership', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const userId = req.user!.userId;

    const result = await query<MembershipRow & {
      community_name: string;
      organization_id: string | null;
      organization_name: string | null;
      organization_slug: string | null;
    }>(
      `SELECT m.id, m.user_id, m.community_id, m.role, m.is_verified_helper, m.training_completed,
              m.profile, m.topics, m.is_available, m.created_at, m.organization_id,
              c.name as community_name,
              o.name as organization_name, o.slug as organization_slug
       FROM memberships m
       JOIN communities c ON c.id = m.community_id
       LEFT JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = $1 AND c.slug = $2 AND c.is_active = true`,
      [userId, slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    const membership = result.rows[0];
    res.json({
      ...membership,
      organization: membership.organization_id ? {
        id: membership.organization_id,
        name: membership.organization_name,
        slug: membership.organization_slug,
      } : null,
    });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/communities/:slug/availability - Toggle helper availability
router.put('/:slug/availability', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { isAvailable } = req.body;
    const userId = req.user!.userId;

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({ error: 'isAvailable must be a boolean' });
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

    // Check if trying to become available - must have completed training
    if (isAvailable) {
      const memberCheck = await query<{ training_completed: boolean }>(
        'SELECT training_completed FROM memberships WHERE user_id = $1 AND community_id = $2',
        [userId, communityId]
      );

      if (memberCheck.rows.length === 0) {
        res.status(404).json({ error: 'Not a member of this community' });
        return;
      }

      if (!memberCheck.rows[0].training_completed) {
        res.status(403).json({
          error: 'Please complete helper training first',
          reason: 'training_required'
        });
        return;
      }
    }

    // Update membership availability
    const result = await query<MembershipRow>(
      `UPDATE memberships
       SET is_available = $1, role = CASE WHEN role = 'seeker' THEN 'both' ELSE role END
       WHERE user_id = $2 AND community_id = $3
       RETURNING *`,
      [isAvailable, userId, communityId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    console.log(`[HELPER] ${isAvailable ? 'Available' : 'Unavailable'}: User ${userId} in ${slug}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/communities/:slug/invite-codes - Generate new invite code (admin only)
router.post('/:slug/invite-codes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { maxUses, expiresInDays, organizationId } = req.body;
    const userId = req.user!.userId;

    // Get community and verify admin
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Check if user is admin
    const membershipResult = await query<MembershipRow>(
      'SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0 || membershipResult.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await query('SELECT id FROM invite_codes WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      code = generateInviteCode();
      attempts++;
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Validate organization belongs to this community if specified
    if (organizationId) {
      const orgCheck = await query(
        'SELECT id FROM organizations WHERE id = $1 AND community_id = $2',
        [organizationId, communityId]
      );
      if (orgCheck.rows.length === 0) {
        res.status(400).json({ error: 'Invalid organization for this community' });
        return;
      }
    }

    // Create invite code
    const result = await query<InviteCodeRow>(
      `INSERT INTO invite_codes (community_id, code, created_by, max_uses, expires_at, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [communityId, code, userId, maxUses || null, expiresAt, organizationId || null]
    );

    console.log(`[INVITE] Code ${code} created for community ${slug}${organizationId ? ` (org: ${organizationId})` : ''} by user ${userId}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/communities/:slug/invite-codes - List invite codes (admin only)
// Query params: ?organization_id=<uuid> to filter by organization
router.get('/:slug/invite-codes', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { organization_id: filterOrgId } = req.query;
    const userId = req.user!.userId;

    // Get community and verify admin
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Check if user is admin
    const membershipResult = await query<MembershipRow>(
      'SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0 || membershipResult.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Build query with optional organization filter
    let queryText = `
      SELECT ic.*, u.email as creator_email, o.name as organization_name, o.slug as organization_slug
      FROM invite_codes ic
      JOIN users u ON u.id = ic.created_by
      LEFT JOIN organizations o ON o.id = ic.organization_id
      WHERE ic.community_id = $1
    `;
    const queryParams: (string | null)[] = [communityId];

    if (filterOrgId && typeof filterOrgId === 'string') {
      queryText += ` AND ic.organization_id = $2`;
      queryParams.push(filterOrgId);
    }

    queryText += ` ORDER BY ic.created_at DESC`;

    const result = await query<InviteCodeRow & { organization_name: string | null; organization_slug: string | null }>(
      queryText,
      queryParams
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List invite codes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/communities/:slug/invite-codes/:codeId - Update invite code (admin only)
router.put('/:slug/invite-codes/:codeId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug, codeId } = req.params;
    const { isActive } = req.body;
    const userId = req.user!.userId;

    // Get community and verify admin
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Check if user is admin
    const membershipResult = await query<MembershipRow>(
      'SELECT role FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0 || membershipResult.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Update invite code
    const result = await query<InviteCodeRow>(
      `UPDATE invite_codes
       SET is_active = $1
       WHERE id = $2 AND community_id = $3
       RETURNING *`,
      [isActive, codeId, communityId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invite code not found' });
      return;
    }

    console.log(`[INVITE] Code ${result.rows[0].code} ${isActive ? 'activated' : 'deactivated'} by user ${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
