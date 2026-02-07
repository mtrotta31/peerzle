import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation, getUserSocketIds } from '../config/socket';
import { generatePeerBotResponse } from '../services/peerbot';
import { analyzeMessageSafety, shouldShowCrisisResources, mapRiskLevelToSeverity, SafetyAnalysisResult } from '../services/safety';
import { sendPushNotification, sendPushToMultipleUsers, shouldSendMessagePush } from '../services/push-notifications';

const router = Router();

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_membership_id: string | null;
  content: string;
  created_at: Date;
  moderation_result: { sender?: string; safety?: SafetyAnalysisResult } | null;
}

interface ConversationInfo {
  helper_membership_id: string | null;
  topic: string | null;
  community_name: string;
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
    const verifyResult = await query<{ membership_id: string; conversation_status: string; community_id: string }>(
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

    const { membership_id, conversation_status, community_id } = verifyResult.rows[0];

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

    // Run async tasks in parallel (don't await - fire and forget)
    // 1. Safety analysis for user messages
    runSafetyAnalysis(message.id, conversationId, community_id, content.trim()).catch((err) => {
      console.error('Safety analysis error:', err);
    });

    // 2. Check if conversation has no helper - if so, trigger PeerBot
    // Pass the sender's membership_id so we can check if they're the helper
    triggerPeerBotIfNeeded(conversationId, membership_id).catch((err) => {
      console.error('PeerBot trigger error:', err);
    });

    // 3. Send push notification to offline recipient(s)
    sendNewMessagePush(conversationId, userId, community_id).catch((err) => {
      console.error('New message push error:', err);
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function runSafetyAnalysis(
  messageId: string,
  conversationId: string,
  communityId: string,
  content: string
): Promise<void> {
  // Get conversation context
  const contextResult = await query<{ topic: string | null }>(
    'SELECT topic FROM conversations WHERE id = $1',
    [conversationId]
  );
  const topic = contextResult.rows[0]?.topic || null;

  // Get recent messages for context (excluding the current one)
  const recentResult = await query<{ content: string }>(
    `SELECT content FROM messages
     WHERE conversation_id = $1 AND id != $2
     ORDER BY created_at DESC LIMIT 3`,
    [conversationId, messageId]
  );
  const recentMessages = recentResult.rows.map((r) => r.content).reverse();

  // Analyze the message
  const safetyResult = await analyzeMessageSafety(content, { topic, recentMessages });

  // Update the message with safety analysis
  await query(
    `UPDATE messages SET moderation_result = $1 WHERE id = $2`,
    [JSON.stringify({ safety: safetyResult }), messageId]
  );

  // Log safety events
  if (safetyResult.riskLevel !== 'safe') {
    console.log(`[SAFETY] ${safetyResult.riskLevel.toUpperCase()} - Conversation: ${conversationId}`);
    console.log(`[SAFETY] Flags: ${safetyResult.flags.join(', ')}`);
    console.log(`[SAFETY] Suggested action: ${safetyResult.suggestedAction}`);
  }

  // If crisis or moderate concern, emit safety alert and log to database
  if (shouldShowCrisisResources(safetyResult.riskLevel)) {
    // Emit safety alert to conversation
    emitToConversation(conversationId, 'safety_alert', {
      riskLevel: safetyResult.riskLevel,
      messageId,
    });

    // Log to alert_events table
    await query(
      `INSERT INTO alert_events (community_id, conversation_id, alert_type, severity, context)
       VALUES ($1, $2, 'safety', $3, $4)`,
      [
        communityId,
        conversationId,
        mapRiskLevelToSeverity(safetyResult.riskLevel),
        JSON.stringify({
          message_id: messageId,
          risk_level: safetyResult.riskLevel,
          flags: safetyResult.flags,
          suggested_action: safetyResult.suggestedAction,
        }),
      ]
    );

    console.log(`[SAFETY] Alert logged to database for conversation: ${conversationId}`);

    // Send push notifications to community admins for crisis-level alerts
    if (safetyResult.riskLevel === 'crisis') {
      // Get community slug for URL
      const communityResult = await query<{ slug: string }>(
        'SELECT slug FROM communities WHERE id = $1',
        [communityId]
      );
      const communitySlug = communityResult.rows[0]?.slug || '';

      // Get all admin user IDs in this community
      const adminsResult = await query<{ user_id: string }>(
        `SELECT m.user_id FROM memberships m
         WHERE m.community_id = $1 AND m.role = 'admin'`,
        [communityId]
      );
      const adminUserIds = adminsResult.rows.map((r) => r.user_id);

      if (adminUserIds.length > 0) {
        sendPushToMultipleUsers(adminUserIds, {
          title: 'Safety Alert',
          body: 'A critical safety concern has been detected.',
          data: {
            url: `/community/${communitySlug}/admin`,
            type: 'safety_alert',
          },
        }).catch((err) => {
          console.error('[SAFETY] Admin push notification error:', err);
        });
      }
    }
  }
}

/**
 * Send push notification to offline conversation participants for new messages.
 * Rate limited to max 1 push per conversation per 60 seconds.
 */
async function sendNewMessagePush(
  conversationId: string,
  senderUserId: string,
  _communityId: string
): Promise<void> {
  // Check rate limit first
  if (!shouldSendMessagePush(conversationId)) {
    return;
  }

  // Get conversation participants and community info
  const result = await query<{
    seeker_user_id: string;
    helper_user_id: string | null;
    community_slug: string;
  }>(
    `SELECT
       seeker_m.user_id as seeker_user_id,
       helper_m.user_id as helper_user_id,
       cm.slug as community_slug
     FROM conversations c
     JOIN memberships seeker_m ON seeker_m.id = c.seeker_membership_id
     LEFT JOIN memberships helper_m ON helper_m.id = c.helper_membership_id
     JOIN communities cm ON cm.id = c.community_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (result.rows.length === 0) return;

  const { seeker_user_id, helper_user_id, community_slug } = result.rows[0];

  // Determine recipient (the other participant, not the sender)
  let recipientUserId: string | null = null;
  if (senderUserId === seeker_user_id && helper_user_id) {
    recipientUserId = helper_user_id;
  } else if (senderUserId === helper_user_id) {
    recipientUserId = seeker_user_id;
  }

  if (!recipientUserId) return;

  // Check if recipient is online (has active socket connections)
  const recipientSocketIds = getUserSocketIds(recipientUserId);
  if (recipientSocketIds.length > 0) {
    // User is online, no push needed
    return;
  }

  // User is offline, send push notification
  // Privacy: Don't include message content
  await sendPushNotification(recipientUserId, {
    title: 'New message',
    body: 'You have a new message in your conversation.',
    data: {
      url: `/community/${community_slug}/chat/${conversationId}`,
      type: 'new_message',
      conversationId,
    },
  });
}

async function triggerPeerBotIfNeeded(conversationId: string, senderMembershipId: string): Promise<void> {
  // Get conversation info
  const conversationResult = await query<ConversationInfo & { seeker_membership_id: string }>(
    `SELECT c.helper_membership_id, c.seeker_membership_id, c.topic, cm.name as community_name, c.community_id
     FROM conversations c
     JOIN communities cm ON cm.id = c.community_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (conversationResult.rows.length === 0) return;

  const { helper_membership_id, seeker_membership_id, topic, community_name } = conversationResult.rows[0];

  // Only respond if no human helper is assigned
  if (helper_membership_id !== null) {
    console.log('[PEERBOT] Helper is assigned, skipping PeerBot response');
    return;
  }

  // Only respond to seeker messages, not helper messages
  if (senderMembershipId !== seeker_membership_id) {
    console.log('[PEERBOT] Message not from seeker, skipping PeerBot response');
    return;
  }

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

  // Re-check if helper has joined during the delay
  const recheckResult = await query<{ helper_membership_id: string | null }>(
    'SELECT helper_membership_id FROM conversations WHERE id = $1',
    [conversationId]
  );

  if (recheckResult.rows[0]?.helper_membership_id !== null) {
    console.log('[PEERBOT] Helper joined during delay, skipping response');
    return;
  }

  // Generate PeerBot response
  const peerBotContent = await generatePeerBotResponse(messages, {
    topic,
    community_name,
  });

  // Save PeerBot message (no safety analysis needed for PeerBot)
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
