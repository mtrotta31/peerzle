import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';
import { startMatchingProcess, cancelMatchingProcess } from '../services/matching-queue';

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
  seeker_rating: number | null;
  helper_rating: number | null;
  safety_flags: unknown[];
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_membership_id: string | null;
  content: string;
  created_at: Date;
  moderation_result: { sender?: string } | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  community_id: string;
}

// POST /api/conversations/start - Start a new conversation
router.post('/start', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, topic } = req.body;
    const userId = req.user!.userId;

    if (!communitySlug) {
      res.status(400).json({ error: 'communitySlug is required' });
      return;
    }

    // Get community
    const communityResult = await query<{ id: string }>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get user's membership in this community
    const membershipResult = await query<MembershipRow>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'You must be a member of this community to start a conversation' });
      return;
    }

    const seekerMembershipId = membershipResult.rows[0].id;

    // Check if user already has an active conversation in this community
    const existingConversation = await query<ConversationRow>(
      `SELECT id FROM conversations
       WHERE seeker_membership_id = $1 AND community_id = $2 AND status != 'ended'`,
      [seekerMembershipId, communityId]
    );

    if (existingConversation.rows.length > 0) {
      res.status(409).json({
        error: 'You already have an active conversation in this community',
        conversationId: existingConversation.rows[0].id
      });
      return;
    }

    // Create conversation
    const result = await query<ConversationRow>(
      `INSERT INTO conversations (community_id, seeker_membership_id, topic, status)
       VALUES ($1, $2, $3, 'matching')
       RETURNING *`,
      [communityId, seekerMembershipId, topic || null]
    );

    const newConversation = result.rows[0];

    // Fire-and-forget: start the smart matching process
    startMatchingProcess(newConversation.id).catch((err) => {
      console.error('Smart matching error:', err);
    });

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/active - Get user's active conversations
router.get('/active', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query<ConversationRow & { community_slug: string; community_name: string }>(
      `SELECT c.*, cm.slug as community_slug, cm.name as community_name
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
       WHERE m.user_id = $1 AND c.status != 'ended'
       ORDER BY c.started_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get active conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/:id - Get conversation with messages
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // First, try to get conversation as a participant (seeker or helper)
    let conversationResult = await query<ConversationRow & { community_slug: string; community_name: string }>(
      `SELECT c.*, cm.slug as community_slug, cm.name as community_name
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    // If not a participant, check if user is an admin of the conversation's community
    if (conversationResult.rows.length === 0) {
      conversationResult = await query<ConversationRow & { community_slug: string; community_name: string }>(
        `SELECT c.*, cm.slug as community_slug, cm.name as community_name
         FROM conversations c
         JOIN communities cm ON cm.id = c.community_id
         JOIN memberships m ON m.community_id = c.community_id AND m.user_id = $2 AND m.role = 'admin'
         WHERE c.id = $1`,
        [id, userId]
      );
    }

    if (conversationResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found or access denied' });
      return;
    }

    const conversation = conversationResult.rows[0];

    // Get messages (LEFT JOIN to include PeerBot messages with null sender)
    const messagesResult = await query<MessageRow & { sender_email: string | null }>(
      `SELECT msg.*, u.email as sender_email
       FROM messages msg
       LEFT JOIN memberships m ON m.id = msg.sender_membership_id
       LEFT JOIN users u ON u.id = m.user_id
       WHERE msg.conversation_id = $1
       ORDER BY msg.created_at ASC`,
      [id]
    );

    res.json({
      ...conversation,
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/end - End a conversation
router.post('/:id/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify user is participant
    const verifyResult = await query(
      `SELECT c.id FROM conversations c
       JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
       WHERE c.id = $1 AND m.user_id = $2 AND c.status != 'ended'`,
      [id, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found or already ended' });
      return;
    }

    // Cancel any active matching process
    cancelMatchingProcess(id);

    // End conversation and get community info
    const result = await query<ConversationRow & { community_slug: string; community_name: string }>(
      `UPDATE conversations
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *,
         (SELECT slug FROM communities WHERE id = conversations.community_id) as community_slug,
         (SELECT name FROM communities WHERE id = conversations.community_id) as community_name`,
      [id]
    );

    const endedConversation = result.rows[0];

    // Emit socket event to notify all participants
    emitToConversation(id, 'conversation_ended', {
      conversationId: id,
      endedBy: userId,
    });

    res.json(endedConversation);
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
