import { query } from '../config/database';
import { emitToUser, emitToConversation } from '../config/socket';
import { findMatchesForConversation, calculateMatchScore, MatchResult } from './matching';
import { generatePeerBotResponse } from './peerbot';
import { sendPushToMultipleUsers } from './push-notifications';

export interface HelpRequestEvent {
  conversationId: string;
  communityId: string;
  topic: string | null;
  matchScore: number;
  startedAt: string;
}

interface MatchProcess {
  conversationId: string;
  matches: MatchResult[];
  notifiedUserIds: Set<string>;
  timeouts: NodeJS.Timeout[];
  cancelled: boolean;
}

// In-memory map of active matching processes
const activeProcesses = new Map<string, MatchProcess>();

/**
 * Send help_request to a set of helpers for a conversation.
 */
async function notifyHelpers(
  process: MatchProcess,
  helpers: MatchResult[],
  conversationId: string,
  communityId: string,
  topic: string | null,
  startedAt: string
): Promise<void> {
  // Get community slug for push notification URL
  const communityResult = await query<{ slug: string }>(
    'SELECT slug FROM communities WHERE id = $1',
    [communityId]
  );
  const communitySlug = communityResult.rows[0]?.slug || '';

  const newlyNotifiedUserIds: string[] = [];

  for (const helper of helpers) {
    if (process.cancelled) return;
    if (process.notifiedUserIds.has(helper.userId)) continue;

    process.notifiedUserIds.add(helper.userId);
    newlyNotifiedUserIds.push(helper.userId);

    const event: HelpRequestEvent = {
      conversationId,
      communityId,
      topic,
      matchScore: helper.matchScore,
      startedAt,
    };
    emitToUser(helper.userId, 'help_request', event);
  }

  // Send push notifications to all newly notified helpers
  // Privacy: Do NOT include seeker name, topic, or any identifying info
  if (newlyNotifiedUserIds.length > 0) {
    sendPushToMultipleUsers(newlyNotifiedUserIds, {
      title: 'Someone needs support',
      body: 'A member of your community is looking for help. Tap to respond.',
      data: {
        url: `/community/${communitySlug}`,
        type: 'help_request',
      },
    }).catch((err) => {
      console.error('[MATCHING] Push notification error:', err);
    });
  }
}

/**
 * Trigger PeerBot fallback: generate a greeting message and emit events.
 */
async function triggerPeerBotFallback(conversationId: string): Promise<void> {
  // Check conversation is still in matching state
  const convResult = await query<{
    status: string;
    helper_membership_id: string | null;
    topic: string | null;
    community_name: string;
  }>(
    `SELECT c.status, c.helper_membership_id, c.topic, cm.name as community_name
     FROM conversations c
     JOIN communities cm ON cm.id = c.community_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convResult.rows.length === 0) return;
  const conv = convResult.rows[0];

  // Only trigger if still matching and no helper has joined
  if (conv.status !== 'matching' || conv.helper_membership_id !== null) return;

  // Generate PeerBot greeting
  const greetingContent = await generatePeerBotResponse(
    [{ content: 'Hello, I need someone to talk to.', sender_email: null, is_peerbot: false }],
    { topic: conv.topic, community_name: conv.community_name }
  );

  // Insert PeerBot message
  const msgResult = await query<{
    id: string;
    conversation_id: string;
    sender_membership_id: string | null;
    content: string;
    created_at: Date;
    moderation_result: { sender?: string } | null;
  }>(
    `INSERT INTO messages (conversation_id, sender_membership_id, content, moderation_result)
     VALUES ($1, NULL, $2, $3)
     RETURNING *`,
    [conversationId, greetingContent, JSON.stringify({ sender: 'peerbot' })]
  );

  const peerBotMessage = msgResult.rows[0];

  // Emit new_message to conversation room
  emitToConversation(conversationId, 'new_message', {
    ...peerBotMessage,
    sender_email: null,
  });

  // Emit peerbot_fallback to conversation room so the seeker's UI can update
  emitToConversation(conversationId, 'peerbot_fallback', {
    conversationId,
  });
}

/**
 * Start the matching process for a conversation.
 * Scores available helpers and notifies them in tiers.
 */
export async function startMatchingProcess(conversationId: string): Promise<void> {
  // Get conversation info
  const convResult = await query<{
    community_id: string;
    topic: string | null;
    started_at: Date;
  }>(
    `SELECT community_id, topic, started_at FROM conversations WHERE id = $1`,
    [conversationId]
  );

  if (convResult.rows.length === 0) return;
  const { community_id, topic, started_at } = convResult.rows[0];
  const startedAt = started_at.toISOString();

  // Find and score all available helpers
  const matches = await findMatchesForConversation(conversationId);

  const process: MatchProcess = {
    conversationId,
    matches,
    notifiedUserIds: new Set(),
    timeouts: [],
    cancelled: false,
  };

  activeProcesses.set(conversationId, process);

  // No helpers available: immediate PeerBot fallback
  if (matches.length === 0) {
    console.log(`[MATCHING] No helpers available for conversation ${conversationId}, triggering PeerBot`);
    triggerPeerBotFallback(conversationId).catch((err) => {
      console.error('[MATCHING] PeerBot fallback error:', err);
    });
    return;
  }

  // 1-2 helpers: skip tiers, notify all immediately
  if (matches.length <= 2) {
    console.log(`[MATCHING] Only ${matches.length} helper(s) for conversation ${conversationId}, notifying all immediately`);
    notifyHelpers(process, matches, conversationId, community_id, topic, startedAt).catch((err) => {
      console.error('[MATCHING] Notify helpers error:', err);
    });

    // Still set 90s fallback
    const fallbackTimeout = setTimeout(() => {
      if (process.cancelled) return;
      console.log(`[MATCHING] 90s fallback for conversation ${conversationId}`);
      triggerPeerBotFallback(conversationId).catch((err) => {
        console.error('[MATCHING] PeerBot fallback error:', err);
      });
    }, 90000);
    process.timeouts.push(fallbackTimeout);
    return;
  }

  // Normal flow (3+ helpers): tiered notifications
  // Tier 1 (0s): helpers with score >= 80
  const tier1 = matches.filter((m) => m.matchScore >= 80);
  console.log(`[MATCHING] Tier 1 (score >= 80): ${tier1.length} helpers for conversation ${conversationId}`);
  notifyHelpers(process, tier1, conversationId, community_id, topic, startedAt).catch((err) => {
    console.error('[MATCHING] Tier 1 notify helpers error:', err);
  });

  // Tier 2 (30s): helpers with score >= 60
  const tier2Timeout = setTimeout(() => {
    if (process.cancelled) return;
    const tier2 = matches.filter((m) => m.matchScore >= 60);
    console.log(`[MATCHING] Tier 2 (score >= 60): ${tier2.length} helpers for conversation ${conversationId}`);
    notifyHelpers(process, tier2, conversationId, community_id, topic, startedAt).catch((err) => {
      console.error('[MATCHING] Tier 2 notify helpers error:', err);
    });
  }, 30000);
  process.timeouts.push(tier2Timeout);

  // Tier 3 (60s): all remaining helpers
  const tier3Timeout = setTimeout(() => {
    if (process.cancelled) return;
    console.log(`[MATCHING] Tier 3 (all): ${matches.length} helpers for conversation ${conversationId}`);
    notifyHelpers(process, matches, conversationId, community_id, topic, startedAt).catch((err) => {
      console.error('[MATCHING] Tier 3 notify helpers error:', err);
    });
  }, 60000);
  process.timeouts.push(tier3Timeout);

  // Fallback (90s): PeerBot
  const fallbackTimeout = setTimeout(() => {
    if (process.cancelled) return;
    console.log(`[MATCHING] 90s fallback for conversation ${conversationId}`);
    triggerPeerBotFallback(conversationId).catch((err) => {
      console.error('[MATCHING] PeerBot fallback error:', err);
    });
  }, 90000);
  process.timeouts.push(fallbackTimeout);
}

/**
 * Cancel an active matching process, clearing all scheduled timeouts.
 */
export function cancelMatchingProcess(conversationId: string): void {
  const process = activeProcesses.get(conversationId);
  if (!process) return;

  process.cancelled = true;
  for (const timeout of process.timeouts) {
    clearTimeout(timeout);
  }
  activeProcesses.delete(conversationId);
  console.log(`[MATCHING] Cancelled matching process for conversation ${conversationId}`);
}

/**
 * Trigger PeerBot early - allows seeker to start chatting with PeerBot
 * while still waiting for a human helper.
 */
export async function triggerPeerBotEarly(conversationId: string): Promise<void> {
  await triggerPeerBotFallback(conversationId);
}

export { calculateMatchScore };
