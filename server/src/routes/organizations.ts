import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

interface OrganizationSettings {
  match_within_org_only: boolean;
  allow_cross_org_matching: boolean;
}

interface OrganizationRow {
  id: string;
  community_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  settings: OrganizationSettings;
  is_active: boolean;
  created_at: Date;
}

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

// Middleware to verify admin role (community-level)
async function requireCommunityAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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

  // Store whether this is a community admin (no org) or org admin (has org)
  req.isOrgAdmin = result.rows[0].organization_id !== null;
  req.adminOrgId = result.rows[0].organization_id;

  next();
}

// Middleware to verify org-level admin access
async function requireOrgAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { communitySlug, orgSlug } = req.params;
  const userId = req.user!.userId;

  // Get the organization
  const orgResult = await query<{ id: string }>(
    `SELECT o.id
     FROM organizations o
     JOIN communities c ON c.id = o.community_id
     WHERE o.slug = $1 AND c.slug = $2`,
    [orgSlug, communitySlug]
  );

  if (orgResult.rows.length === 0) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }

  const orgId = orgResult.rows[0].id;

  // Check if user is admin for this org or community-level admin
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

  // Community admin (no org_id) can access all orgs
  // Org admin can only access their own org
  const membership = result.rows[0];
  if (membership.organization_id !== null && membership.organization_id !== orgId) {
    res.status(403).json({ error: 'Access denied to this organization' });
    return;
  }

  next();
}

// Extend AuthenticatedRequest to include org admin info
declare module '../middleware/auth' {
  interface AuthenticatedRequest {
    isOrgAdmin?: boolean;
    adminOrgId?: string | null;
  }
}

// GET /api/organizations/:communitySlug - List all organizations in a community
router.get('/:communitySlug', authenticate, requireCommunityAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;

    // If org admin, only return their organization
    let orgFilter = '';
    const params: (string | null)[] = [communitySlug];

    if (req.isOrgAdmin && req.adminOrgId) {
      orgFilter = 'AND o.id = $2';
      params.push(req.adminOrgId);
    }

    const result = await query<OrganizationRow & { member_count: string; helper_count: string; invite_code_count: string }>(
      `SELECT o.*,
              (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id) as member_count,
              (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id AND m.role IN ('helper', 'both', 'admin')) as helper_count,
              (SELECT COUNT(*) FROM invite_codes ic WHERE ic.organization_id = o.id AND ic.is_active = true) as invite_code_count
       FROM organizations o
       JOIN communities c ON c.id = o.community_id
       WHERE c.slug = $1 ${orgFilter}
       ORDER BY o.name ASC`,
      params
    );

    const organizations = result.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      primaryContactEmail: row.primary_contact_email,
      settings: row.settings,
      isActive: row.is_active,
      createdAt: row.created_at,
      memberCount: parseInt(row.member_count, 10),
      helperCount: parseInt(row.helper_count, 10),
      inviteCodeCount: parseInt(row.invite_code_count, 10),
    }));

    res.json(organizations);
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/organizations/:communitySlug - Create new organization
router.post('/:communitySlug', authenticate, requireCommunityAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const { name, slug: providedSlug, primaryContactEmail, settings } = req.body;

    // Org admins cannot create new organizations
    if (req.isOrgAdmin) {
      res.status(403).json({ error: 'Only community administrators can create organizations' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Organization name is required' });
      return;
    }

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
    const slug = providedSlug ? generateSlug(providedSlug) : generateSlug(name);

    // Default settings
    const orgSettings: OrganizationSettings = {
      match_within_org_only: settings?.match_within_org_only ?? true,
      allow_cross_org_matching: settings?.allow_cross_org_matching ?? false,
    };

    const result = await query<OrganizationRow>(
      `INSERT INTO organizations (community_id, name, slug, primary_contact_email, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [communityId, name.trim(), slug, primaryContactEmail || null, JSON.stringify(orgSettings)]
    );

    const org = result.rows[0];
    res.status(201).json({
      id: org.id,
      communityId: org.community_id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url,
      primaryContactEmail: org.primary_contact_email,
      settings: org.settings,
      isActive: org.is_active,
      createdAt: org.created_at,
    });
  } catch (error: unknown) {
    console.error('Create organization error:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      res.status(400).json({ error: 'An organization with this slug already exists in this community' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/organizations/:communitySlug/:orgSlug - Get single organization
router.get('/:communitySlug/:orgSlug', authenticate, requireOrgAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, orgSlug } = req.params;

    const result = await query<OrganizationRow & { member_count: string; helper_count: string; active_helper_count: string; conversation_count: string }>(
      `SELECT o.*,
              (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id) as member_count,
              (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id AND m.role IN ('helper', 'both', 'admin')) as helper_count,
              (SELECT COUNT(*) FROM memberships m WHERE m.organization_id = o.id AND m.role IN ('helper', 'both', 'admin') AND m.is_available = true) as active_helper_count,
              (SELECT COUNT(*) FROM conversations c WHERE c.seeker_membership_id IN (SELECT id FROM memberships WHERE organization_id = o.id)) as conversation_count
       FROM organizations o
       JOIN communities c ON c.id = o.community_id
       WHERE o.slug = $1 AND c.slug = $2`,
      [orgSlug, communitySlug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = result.rows[0];
    res.json({
      id: org.id,
      communityId: org.community_id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url,
      primaryContactEmail: org.primary_contact_email,
      settings: org.settings,
      isActive: org.is_active,
      createdAt: org.created_at,
      memberCount: parseInt(org.member_count, 10),
      helperCount: parseInt(org.helper_count, 10),
      activeHelperCount: parseInt(org.active_helper_count, 10),
      conversationCount: parseInt(org.conversation_count, 10),
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/organizations/:communitySlug/:orgSlug - Update organization
router.put('/:communitySlug/:orgSlug', authenticate, requireOrgAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, orgSlug } = req.params;
    const { name, primaryContactEmail, settings, logoUrl, isActive } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (primaryContactEmail !== undefined) {
      updates.push(`primary_contact_email = $${paramIndex++}`);
      values.push(primaryContactEmail || null);
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(settings));
    }
    if (logoUrl !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(logoUrl || null);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(orgSlug, communitySlug);

    const result = await query<OrganizationRow>(
      `UPDATE organizations o
       SET ${updates.join(', ')}
       FROM communities c
       WHERE o.community_id = c.id AND o.slug = $${paramIndex++} AND c.slug = $${paramIndex}
       RETURNING o.*`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = result.rows[0];
    res.json({
      id: org.id,
      communityId: org.community_id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url,
      primaryContactEmail: org.primary_contact_email,
      settings: org.settings,
      isActive: org.is_active,
      createdAt: org.created_at,
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/organizations/:communitySlug/:orgSlug/members - List members in organization
router.get('/:communitySlug/:orgSlug/members', authenticate, requireOrgAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, orgSlug } = req.params;

    const result = await query<{
      id: string;
      email: string;
      role: string;
      is_available: boolean;
      is_verified_helper: boolean;
      display_name: string | null;
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
        m.is_verified_helper,
        m.display_name,
        m.created_at,
        (SELECT COUNT(*) FROM conversations c WHERE c.seeker_membership_id = m.id)::text as seeker_conversations,
        (SELECT COUNT(*) FROM conversations c WHERE c.helper_membership_id = m.id AND c.status = 'ended')::text as helper_conversations,
        (SELECT AVG(cr.rating)::numeric(3,2)
         FROM conversation_ratings cr
         JOIN conversations c ON c.id = cr.conversation_id
         WHERE c.helper_membership_id = m.id AND cr.role = 'seeker')::text as avg_helper_rating
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       JOIN organizations o ON o.id = m.organization_id
       JOIN communities c ON c.id = o.community_id
       WHERE o.slug = $1 AND c.slug = $2
       ORDER BY m.created_at DESC`,
      [orgSlug, communitySlug]
    );

    const members = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      isAvailable: row.is_available,
      isVerifiedHelper: row.is_verified_helper,
      displayName: row.display_name,
      joinedAt: row.created_at,
      seekerConversations: parseInt(row.seeker_conversations, 10),
      helperConversations: parseInt(row.helper_conversations, 10),
      avgHelperRating: row.avg_helper_rating ? parseFloat(row.avg_helper_rating) : null,
    }));

    res.json(members);
  } catch (error) {
    console.error('List organization members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/organizations/:communitySlug/:orgSlug/invite-codes - Generate org-specific invite code
router.post('/:communitySlug/:orgSlug/invite-codes', authenticate, requireOrgAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, orgSlug } = req.params;
    const { maxUses, expiresInDays } = req.body;
    const userId = req.user!.userId;

    // Get community and organization IDs
    const orgResult = await query<{ org_id: string; community_id: string }>(
      `SELECT o.id as org_id, c.id as community_id
       FROM organizations o
       JOIN communities c ON c.id = o.community_id
       WHERE o.slug = $1 AND c.slug = $2`,
      [orgSlug, communitySlug]
    );

    if (orgResult.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const { org_id, community_id } = orgResult.rows[0];

    // Generate unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Calculate expiration if specified
    let expiresAt: Date | null = null;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const result = await query<{
      id: number;
      code: string;
      max_uses: number | null;
      current_uses: number;
      expires_at: Date | null;
      is_active: boolean;
      created_at: Date;
      organization_id: string;
    }>(
      `INSERT INTO invite_codes (community_id, organization_id, code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, code, max_uses, current_uses, expires_at, is_active, created_at, organization_id`,
      [community_id, org_id, code, userId, maxUses || null, expiresAt]
    );

    const inviteCode = result.rows[0];
    res.status(201).json({
      id: inviteCode.id,
      code: inviteCode.code,
      organizationId: inviteCode.organization_id,
      maxUses: inviteCode.max_uses,
      currentUses: inviteCode.current_uses,
      expiresAt: inviteCode.expires_at,
      isActive: inviteCode.is_active,
      createdAt: inviteCode.created_at,
    });
  } catch (error) {
    console.error('Create org invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
