import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';

const router = Router();

interface ConversationRow {
  id: string;
  community_id: string;
  seeker_membership_id: string;
  helper_membership_id: string | null;
  topic: string | null;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  community_slug: string;
  community_name: string;
  seeker_email: string;
}

interface MembershipRow {
  id: string;
  community_id: string;
  is_available: boolean;
  is_verified_helper: boolean;
}

// GET /api/helpers/pending - Get conversations waiting for helpers
router.get('/pending', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    console.log(`[HELPER] Fetching pending conversations for user: ${userId}`);

    // Get pending conversations from communities where user is an available helper
    const result = await query<ConversationRow>(
      `SELECT c.id, c.community_id, c.seeker_membership_id, c.helper_membership_id,
              c.topic, c.status, c.started_at, c.ended_at,
              cm.slug as community_slug, cm.name as community_name,
              u.email as seeker_email
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.community_id = c.community_id AND m.user_id = $1
       JOIN memberships seeker_m ON seeker_m.id = c.seeker_membership_id
       JOIN users u ON u.id = seeker_m.user_id
       WHERE c.status = 'matching'
         AND c.helper_membership_id IS NULL
         AND m.is_available = true
         AND m.role IN ('helper', 'both')
         AND c.seeker_membership_id != m.id
       ORDER BY c.started_at ASC`,
      [userId]
    );

    console.log(`[HELPER] Found ${result.rows.length} pending conversations`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get pending conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/helpers/accept/:conversationId - Accept a conversation as helper
router.post('/accept/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.userId;

    // Get conversation and verify it's still in matching status
    const convResult = await query<ConversationRow & { community_id: string }>(
      `SELECT c.*, cm.slug as community_slug, cm.name as community_name
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       WHERE c.id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = convResult.rows[0];

    if (conversation.status !== 'matching') {
      res.status(400).json({ error: 'Conversation is no longer available' });
      return;
    }

    if (conversation.helper_membership_id) {
      res.status(400).json({ error: 'Conversation already has a helper' });
      return;
    }

    // Get user's membership in this community
    const membershipResult = await query<MembershipRow>(
      `SELECT id, community_id, is_available, is_verified_helper FROM memberships
       WHERE user_id = $1 AND community_id = $2`,
      [userId, conversation.community_id]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'You are not a member of this community' });
      return;
    }

    const membership = membershipResult.rows[0];

    // Prevent helper from accepting their own conversation
    if (conversation.seeker_membership_id === membership.id) {
      res.status(400).json({ error: 'You cannot accept your own conversation' });
      return;
    }

    // Update conversation with helper
    const updateResult = await query<ConversationRow>(
      `UPDATE conversations
       SET helper_membership_id = $1, status = 'active'
       WHERE id = $2
       RETURNING *`,
      [membership.id, conversationId]
    );

    // Get helper email for the socket event
    const helperResult = await query<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    const helperEmail = helperResult.rows[0]?.email;

    // Emit helper_joined event to conversation
    emitToConversation(conversationId, 'helper_joined', {
      conversationId,
      helperEmail,
      helperMembershipId: membership.id,
      isVerifiedHelper: membership.is_verified_helper || false,
    });

    console.log(`[HELPER] Accepted conversation ${conversationId}: Helper ${helperEmail}`);

    res.json({
      ...updateResult.rows[0],
      community_slug: conversation.community_slug,
      community_name: conversation.community_name,
    });
  } catch (error) {
    console.error('Accept conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
