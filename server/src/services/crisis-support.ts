/**
 * Crisis Support Service
 *
 * Sends warm, supportive PeerBot messages with crisis resources
 * when concerning content is detected in conversations.
 */

import { query } from '../config/database';
import { emitToConversation } from '../config/socket';
import { getCrisisResources, formatCrisisMessage } from '../data/crisis-resources';
import type { RiskLevel } from './safety';

const COOLDOWN_MINUTES = 5;

interface CommunityInfo {
  slug: string;
}

interface ConversationParticipants {
  helper_membership_id: string | null;
}

interface RecentCrisisMessage {
  id: string;
}

interface InsertedMessage {
  id: string;
  created_at: Date;
}

/**
 * Send a PeerBot crisis support message to a conversation.
 * Called when moderate_concern or crisis level content is detected.
 *
 * Features:
 * - 5-minute cooldown to prevent message spam on multiple concerning messages
 * - Community-specific resources (Veterans get Veterans Crisis Line)
 * - Notifies helpers when resources are shared
 */
export async function sendCrisisSupportMessage(
  conversationId: string,
  communityId: string,
  riskLevel: RiskLevel,
  triggeringMessageId: string
): Promise<void> {
  // Only handle moderate_concern and crisis levels
  if (riskLevel !== 'moderate_concern' && riskLevel !== 'crisis') {
    return;
  }

  // Check for cooldown - don't send if we sent a crisis support message recently
  const recentResult = await query<RecentCrisisMessage>(
    `SELECT id FROM messages
     WHERE conversation_id = $1
       AND moderation_result->>'type' = 'crisis_support'
       AND created_at > NOW() - INTERVAL '${COOLDOWN_MINUTES} minutes'
     LIMIT 1`,
    [conversationId]
  );

  if (recentResult.rows.length > 0) {
    console.log(
      `[CRISIS-SUPPORT] Skipping - sent within last ${COOLDOWN_MINUTES} minutes for conversation: ${conversationId}`
    );
    return;
  }

  // Get community slug for community-specific resources
  const communityResult = await query<CommunityInfo>(
    'SELECT slug FROM communities WHERE id = $1',
    [communityId]
  );

  if (communityResult.rows.length === 0) {
    console.error('[CRISIS-SUPPORT] Community not found:', communityId);
    return;
  }

  const { slug } = communityResult.rows[0];
  const resources = getCrisisResources(slug);
  const messageContent = formatCrisisMessage(resources);

  // Insert PeerBot crisis support message
  const messageResult = await query<InsertedMessage>(
    `INSERT INTO messages (conversation_id, sender_membership_id, content, moderation_result)
     VALUES ($1, NULL, $2, $3)
     RETURNING id, created_at`,
    [
      conversationId,
      messageContent,
      JSON.stringify({
        sender: 'peerbot',
        type: 'crisis_support',
        triggered_by: triggeringMessageId,
        risk_level: riskLevel,
      }),
    ]
  );

  const newMessage = {
    id: messageResult.rows[0].id,
    conversation_id: conversationId,
    sender_membership_id: null,
    content: messageContent,
    created_at: messageResult.rows[0].created_at,
    moderation_result: { sender: 'peerbot', type: 'crisis_support' },
    sender_email: null,
  };

  // Emit to conversation - all participants see the message
  emitToConversation(conversationId, 'new_message', newMessage);

  console.log(
    `[CRISIS-SUPPORT] Sent support message for ${riskLevel} - conversation: ${conversationId}`
  );

  // Check if there's a helper in the conversation
  const participantsResult = await query<ConversationParticipants>(
    `SELECT helper_membership_id FROM conversations WHERE id = $1`,
    [conversationId]
  );

  const helper = participantsResult.rows[0];

  // If helper is present, emit notification that resources were shared
  if (helper?.helper_membership_id) {
    emitToConversation(conversationId, 'safety_resources_shared', {
      conversationId,
      riskLevel,
      messageId: newMessage.id,
    });

    console.log(
      `[CRISIS-SUPPORT] Helper notified of shared resources - conversation: ${conversationId}`
    );
  }
}
