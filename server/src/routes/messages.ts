import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';

const router = Router();

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_membership_id: string;
  content: string;
  created_at: Date;
  moderation_result: unknown | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  community_id: string;
}

// POST /api/messages - Send a message
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId, content } = req.body;
    const userId = req.user!.userId;

    if (!conversationId || !content) {
      res.status(400).json({ error: 'conversationId and content are required' });
      return;
    }

    if (content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    // Verify user is participant in conversation and get their membership
    const verifyResult = await query<MembershipRow & { conversation_status: string; community_id: string }>(
      `SELECT m.id as membership_id, c.status as conversation_status, c.community_id
       FROM conversations c
       JOIN memberships m ON (m.id = c.seeker_membership_id OR m.id = c.helper_membership_id)
       WHERE c.id = $1 AND m.user_id = $2`,
      [conversationId, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(403).json({ error: 'Access denied to this conversation' });
      return;
    }

    const { membership_id, conversation_status } = verifyResult.rows[0];

    if (conversation_status === 'ended') {
      res.status(400).json({ error: 'Cannot send messages to ended conversation' });
      return;
    }

    // Save message
    const messageResult = await query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_membership_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, membership_id, content.trim()]
    );

    const message = messageResult.rows[0];

    // Get sender email for the response
    const senderResult = await query<{ email: string }>(
      `SELECT u.email FROM users u
       JOIN memberships m ON m.user_id = u.id
       WHERE m.id = $1`,
      [membership_id]
    );

    const messageWithSender = {
      ...message,
      sender_email: senderResult.rows[0]?.email,
    };

    // Emit message to conversation room
    emitToConversation(conversationId, 'new_message', messageWithSender);

    res.status(201).json(messageWithSender);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
