import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/superAdmin';

const router = Router();

// Apply authentication and super admin check to all routes
router.use(authenticate);
router.use(requireSuperAdmin);

// ============================================================================
// PLATFORM OVERVIEW
// ============================================================================

// GET /api/super-admin/overview - Platform-wide statistics
router.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      communitiesResult,
      orgsResult,
      usersResult,
      conversationsResult,
      weekResult,
      monthResult,
      activeCommunitiesResult,
    ] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM communities'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM organizations'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM conversations'),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE started_at >= NOW() - INTERVAL '7 days'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM conversations
         WHERE started_at >= NOW() - INTERVAL '30 days'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT community_id) as count FROM conversations
         WHERE started_at >= NOW() - INTERVAL '30 days'`
      ),
    ]);

    res.json({
      totalCommunities: parseInt(communitiesResult.rows[0].count),
      totalOrganizations: parseInt(orgsResult.rows[0].count),
      totalUsers: parseInt(usersResult.rows[0].count),
      totalConversations: parseInt(conversationsResult.rows[0].count),
      conversationsThisWeek: parseInt(weekResult.rows[0].count),
      conversationsThisMonth: parseInt(monthResult.rows[0].count),
      activeCommunities: parseInt(activeCommunitiesResult.rows[0].count),
    });
  } catch (error) {
    console.error('Super admin overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// COMMUNITY MANAGEMENT
// ============================================================================

interface CommunityRow {
  id: string;
  slug: string;
  name: string;
  verification_method: string;
  is_public: boolean;
  config: {
    branding?: { primaryColor?: string; secondaryColor?: string };
    terminology?: { helper?: string; seeker?: string };
    topics?: string[];
    description?: string | null;
  };
  created_at: Date;
  member_count: string;
  org_count: string;
  conversation_count: string;
}

// GET /api/super-admin/communities - List all communities
router.get('/communities', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query<CommunityRow>(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM memberships WHERE community_id = c.id) as member_count,
         (SELECT COUNT(*) FROM organizations WHERE community_id = c.id) as org_count,
         (SELECT COUNT(*) FROM conversations WHERE community_id = c.id) as conversation_count
       FROM communities c
       ORDER BY c.created_at DESC`
    );

    const communities = result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.config?.description || null,
      verificationMethod: row.verification_method,
      isPublic: row.is_public,
      branding: row.config?.branding || {},
      terminology: row.config?.terminology || {},
      createdAt: row.created_at,
      memberCount: parseInt(row.member_count),
      orgCount: parseInt(row.org_count),
      conversationCount: parseInt(row.conversation_count),
    }));

    res.json(communities);
  } catch (error) {
    console.error('List communities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/super-admin/communities - Create a new community
router.post('/communities', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      slug,
      description,
      topics,
      verificationMethod,
      branding,
      terminology,
    } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    // Check slug is unique
    const existingSlug = await query(
      'SELECT id FROM communities WHERE slug = $1',
      [slug.toLowerCase()]
    );

    if (existingSlug.rows.length > 0) {
      res.status(409).json({ error: 'A community with this slug already exists' });
      return;
    }

    // Build config object
    const config = {
      branding: {
        primaryColor: branding?.primaryColor || '#2B7CF6',
        secondaryColor: branding?.secondaryColor || '#1E3A5F',
      },
      terminology: {
        helper: terminology?.helperTerm || 'Peer Support Specialist',
        seeker: terminology?.seekerTerm || 'Member',
        conversation: 'conversation',
      },
      topics: (topics || []).map((t: { name: string }) => t.name),
    };

    // Create community (note: description is stored in config, not a separate column)
    const communityResult = await query<{ id: string; slug: string; created_at: Date }>(
      `INSERT INTO communities (name, slug, verification_method, is_public, config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, slug, created_at`,
      [
        name,
        slug.toLowerCase(),
        verificationMethod || 'invite_code',
        false,
        JSON.stringify({ ...config, description: description || null }),
      ]
    );

    const community = communityResult.rows[0];

    // Topics are already stored in config.topics (set at line 158)
    // No separate community_topics table needed

    // Generate initial invite code
    const code = generateInviteCode();
    await query(
      `INSERT INTO invite_codes (community_id, code, created_by, is_active)
       VALUES ($1, $2, $3, true)`,
      [community.id, code, req.user!.userId]
    );

    // Auto-create admin membership for the super admin
    await query(
      `INSERT INTO memberships (user_id, community_id, role, onboarding_completed, is_verified_helper)
       VALUES ($1, $2, 'admin', true, true)`,
      [req.user!.userId, community.id]
    );

    res.status(201).json({
      id: community.id,
      slug: community.slug,
      name,
      description,
      verificationMethod: verificationMethod || 'invite_code',
      branding: config.branding,
      terminology: config.terminology,
      topics: topics || [],
      createdAt: community.created_at,
      initialInviteCode: code,
    });
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to generate invite codes
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/super-admin/communities/:slug - Get community details
router.get('/communities/:slug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await query<CommunityRow>(
      `SELECT
         c.*,
         (SELECT COUNT(*) FROM memberships WHERE community_id = c.id) as member_count,
         0 as org_count,
         (SELECT COUNT(*) FROM conversations WHERE community_id = c.id) as conversation_count
       FROM communities c
       WHERE c.slug = $1`,
      [slug]
    );
    // Note: org_count hardcoded to 0 until organizations table schema is fixed

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const row = result.rows[0];

    res.json({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.config?.description || null,
      verificationMethod: row.verification_method,
      isPublic: row.is_public,
      branding: row.config?.branding || {},
      terminology: row.config?.terminology || {},
      createdAt: row.created_at,
      memberCount: parseInt(row.member_count),
      orgCount: parseInt(row.org_count),
      conversationCount: parseInt(row.conversation_count),
    });
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/super-admin/communities/:slug - Update community settings
router.put('/communities/:slug', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { name, description, branding, terminology, verificationMethod } = req.body;

    // Get existing community
    const existing = await query<{ id: string; config: Record<string, unknown> }>(
      'SELECT id, config FROM communities WHERE slug = $1',
      [slug]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const community = existing.rows[0];
    const config = community.config || {};

    // Update config if branding or terminology provided
    if (branding) {
      config.branding = {
        primaryColor: branding.primaryColor || (config.branding as Record<string, string>)?.primaryColor || '#2B7CF6',
        secondaryColor: branding.secondaryColor || (config.branding as Record<string, string>)?.secondaryColor || '#1E3A5F',
      };
    }

    if (terminology) {
      config.terminology = {
        helper: terminology.helperTerm || (config.terminology as Record<string, string>)?.helper || 'Peer Support Specialist',
        seeker: terminology.seekerTerm || (config.terminology as Record<string, string>)?.seeker || 'Member',
        conversation: 'conversation',
      };
    }

    // Store description in config
    if (description !== undefined) {
      config.description = description;
    }

    await query(
      `UPDATE communities
       SET name = COALESCE($1, name),
           config = $2,
           verification_method = COALESCE($3, verification_method)
       WHERE id = $4`,
      [name, JSON.stringify(config), verificationMethod, community.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// TOPIC MANAGEMENT (uses config.topics JSONB array)
// ============================================================================

// GET /api/super-admin/communities/:slug/topics - Get topics for a community
router.get('/communities/:slug/topics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const communityResult = await query<{ id: string; config: { topics?: string[] } }>(
      'SELECT id, config FROM communities WHERE slug = $1',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const topics = communityResult.rows[0].config?.topics || [];

    // Return topics with index-based IDs for compatibility
    res.json(
      topics.map((name, index) => ({
        id: index,
        name,
        description: null,
        sortOrder: index,
      }))
    );
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/super-admin/communities/:slug/topics - Add a topic
router.post('/communities/:slug/topics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Topic name is required' });
      return;
    }

    const communityResult = await query<{ id: string; config: { topics?: string[] } }>(
      'SELECT id, config FROM communities WHERE slug = $1',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const community = communityResult.rows[0];
    const config = community.config || {};
    const topics = config.topics || [];

    // Check for duplicate
    if (topics.includes(name)) {
      res.status(409).json({ error: 'Topic already exists' });
      return;
    }

    // Add topic to config.topics array
    topics.push(name);
    config.topics = topics;

    await query('UPDATE communities SET config = $1 WHERE id = $2', [
      JSON.stringify(config),
      community.id,
    ]);

    res.status(201).json({
      id: topics.length - 1,
      name,
      description: null,
      sortOrder: topics.length - 1,
    });
  } catch (error) {
    console.error('Add topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/super-admin/communities/:slug/topics/:topicIndex - Update a topic
router.put('/communities/:slug/topics/:topicIndex', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug, topicIndex } = req.params;
    const { name } = req.body;
    const index = parseInt(topicIndex);

    const communityResult = await query<{ id: string; config: { topics?: string[] } }>(
      'SELECT id, config FROM communities WHERE slug = $1',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const community = communityResult.rows[0];
    const config = community.config || {};
    const topics = config.topics || [];

    if (index < 0 || index >= topics.length) {
      res.status(404).json({ error: 'Topic not found' });
      return;
    }

    // Update topic name
    if (name) {
      topics[index] = name;
      config.topics = topics;

      await query('UPDATE communities SET config = $1 WHERE id = $2', [
        JSON.stringify(config),
        community.id,
      ]);
    }

    res.json({
      id: index,
      name: topics[index],
      description: null,
      sortOrder: index,
    });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/super-admin/communities/:slug/topics/:topicIndex - Remove a topic
router.delete('/communities/:slug/topics/:topicIndex', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { slug, topicIndex } = req.params;
    const index = parseInt(topicIndex);

    const communityResult = await query<{ id: string; config: { topics?: string[] } }>(
      'SELECT id, config FROM communities WHERE slug = $1',
      [slug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const community = communityResult.rows[0];
    const config = community.config || {};
    const topics = config.topics || [];

    if (index < 0 || index >= topics.length) {
      res.status(404).json({ error: 'Topic not found' });
      return;
    }

    // Remove topic from array
    topics.splice(index, 1);
    config.topics = topics;

    await query('UPDATE communities SET config = $1 WHERE id = $2', [
      JSON.stringify(config),
      community.id,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ORGANIZATION MANAGEMENT
// Note: Organizations feature disabled until database schema is fixed
// The organizations table currently has wrong schema (community_ids array instead of community_id FK)
// ============================================================================

// GET /api/super-admin/communities/:slug/organizations - Get organizations for a specific community
router.get('/communities/:slug/organizations', async (_req: AuthenticatedRequest, res: Response) => {
  // Organizations feature disabled until schema is fixed
  res.json([]);
});

// GET /api/super-admin/organizations - List all organizations
router.get('/organizations', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    // Organizations feature disabled until schema is fixed
    // The organizations table currently has wrong schema (community_ids array instead of community_id FK)
    res.json([]);
  } catch (error) {
    console.error('List organizations error:', error);
    res.json([]); // Return empty array instead of error
  }
});

export default router;
