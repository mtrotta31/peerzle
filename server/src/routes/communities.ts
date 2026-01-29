import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface CommunityRow {
  id: string;
  slug: string;
  name: string;
  config: Record<string, unknown>;
  verification_method: string;
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
  profile: Record<string, unknown>;
  topics: unknown[];
  is_available: boolean;
  created_at: Date;
}

// GET /api/communities - List all active communities
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<CommunityRow>(
      'SELECT id, slug, name, config, verification_method, helper_verification_required, created_at FROM communities WHERE is_active = true ORDER BY name'
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
      'SELECT id, slug, name, config, verification_method, helper_verification_required, created_at FROM communities WHERE slug = $1 AND is_active = true',
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

// POST /api/communities/:slug/join - Join a community
router.post('/:slug/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

    // Check if already a member
    const existingMembership = await query<MembershipRow>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (existingMembership.rows.length > 0) {
      res.status(409).json({ error: 'Already a member of this community' });
      return;
    }

    // Create membership
    const result = await query<MembershipRow>(
      `INSERT INTO memberships (user_id, community_id, role)
       VALUES ($1, $2, 'seeker')
       RETURNING id, user_id, community_id, role, is_verified_helper, profile, topics, is_available, created_at`,
      [userId, communityId]
    );

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

    const result = await query<MembershipRow & { community_name: string }>(
      `SELECT m.id, m.user_id, m.community_id, m.role, m.is_verified_helper, m.profile, m.topics, m.is_available, m.created_at, c.name as community_name
       FROM memberships m
       JOIN communities c ON c.id = m.community_id
       WHERE m.user_id = $1 AND c.slug = $2 AND c.is_active = true`,
      [userId, slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
