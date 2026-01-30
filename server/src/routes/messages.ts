import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';
import { generatePeerBotResponse } from '../services/peerbot';

const router = Router();

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

interface ConversationInfo {
  helper_membership_id: string | null;
  topic: string | null;
  community_name: string;
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

    // Check if conversation has no helper - if so, trigger PeerBot
    triggerPeerBotIfNeeded(conversationId).catch((err) => {
      console.error('PeerBot trigger error:', err);
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function triggerPeerBotIfNeeded(conversationId: string): Promise<void> {
  // Get conversation info
  const conversationResult = await query<ConversationInfo>(
    `SELECT c.helper_membership_id, c.topic, cm.name as community_name
     FROM conversations c
     JOIN communities cm ON cm.id = c.community_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (conversationResult.rows.length === 0) return;

  const { helper_membership_id, topic, community_name } = conversationResult.rows[0];

  // Only respond if no human helper is assigned
  if (helper_membership_id !== null) return;

  // Get recent messages for context
  const messagesResult = await query<MessageRow & { sender_email: string | null }>(
    `SELECT msg.*, u.email as sender_email
     FROM messages msg
     LEFT JOIN memberships m ON m.id = msg.sender_membership_id
     LEFT JOIN users u ON u.id = m.user_id
     WHERE msg.conversation_id = $1
     ORDER BY msg.created_at ASC`,
    [conversationId]
  );

  const messages = messagesResult.rows.map((msg) => ({
    content: msg.content,
    sender_email: msg.sender_email,
    is_peerbot: msg.moderation_result?.sender === 'peerbot',
  }));

  // Add a small delay to feel more natural (1.5 seconds)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate PeerBot response
  const peerBotContent = await generatePeerBotResponse(messages, {
    topic,
    community_name,
  });

  // Save PeerBot message
  const peerBotMessageResult = await query<MessageRow>(
    `INSERT INTO messages (conversation_id, sender_membership_id, content, moderation_result)
     VALUES ($1, NULL, $2, $3)
     RETURNING *`,
    [conversationId, peerBotContent, JSON.stringify({ sender: 'peerbot' })]
  );

  const peerBotMessage = peerBotMessageResult.rows[0];

  // Emit PeerBot message to conversation room
  emitToConversation(conversationId, 'new_message', {
    ...peerBotMessage,
    sender_email: null,
  });
}

export default router;
