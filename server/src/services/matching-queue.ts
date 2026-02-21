import { query } from '../config/database';
import { emitToUser, emitToConversation } from '../config/socket';
import { findMatchesForConversation, calculateMatchScore, MatchResult } from './matching';
import { generatePeerBotResponse } from './peerbot';
import { sendPushToMultipleUsers } from './push-notifications';
import { generateDisplayName } from '../data/display-names';

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

// Demo connection data for fake helper matching (matches frontend ConnectionData interface)
export interface DemoConnectionData {
  match_score: number;
  seeker_display_name: string | null;
  helper_display_name: string;
  helper_is_verified: boolean;
  shared_topics: string[];
}

// In-memory map of active matching processes
const activeProcesses = new Map<string, MatchProcess>();

/**
 * Check if a community is a demo community (bypasses real matching).
 */
async function isDemoCommunity(communityId: string): Promise<boolean> {
  const result = await query<{ is_demo: boolean }>(
    'SELECT is_demo FROM communities WHERE id = $1',
    [communityId]
  );
  return result.rows[0]?.is_demo === true;
}

/**
 * Get seeker's topics for generating the connection card.
 */
async function getSeekerTopics(seekerMembershipId: string): Promise<string[]> {
  const result = await query<{ topic: string }>(
    'SELECT topic FROM user_experience_topics WHERE membership_id = $1',
    [seekerMembershipId]
  );
  return result.rows.map((r) => r.topic);
}

/**
 * Get seeker's display name for the connection card.
 */
async function getSeekerDisplayName(seekerMembershipId: string): Promise<string | null> {
  const result = await query<{ display_name: string | null }>(
    'SELECT display_name FROM memberships WHERE id = $1',
    [seekerMembershipId]
  );
  return result.rows[0]?.display_name || null;
}

/**
 * Generate fake connection data for demo matching.
 */
function generateDemoConnectionData(
  seekerTopics: string[],
  conversationTopic: string | null,
  seekerDisplayName: string | null
): DemoConnectionData {
  // Random match score between 78-95%
  const matchScore = Math.floor(Math.random() * 18) + 78;

  // Pick 1-2 shared topics (prefer the conversation topic if it exists)
  const sharedTopics: string[] = [];
  if (conversationTopic && seekerTopics.includes(conversationTopic)) {
    sharedTopics.push(conversationTopic);
  }

  // Add another topic if available
  const otherTopics = seekerTopics.filter((t) => t !== conversationTopic);
  if (otherTopics.length > 0 && (sharedTopics.length === 0 || Math.random() > 0.5)) {
    const randomTopic = otherTopics[Math.floor(Math.random() * otherTopics.length)];
    sharedTopics.push(randomTopic);
  }

  // Fallback to conversation topic or first seeker topic
  if (sharedTopics.length === 0) {
    sharedTopics.push(conversationTopic || seekerTopics[0] || 'General Support');
  }

  return {
    match_score: matchScore,
    seeker_display_name: seekerDisplayName,
    helper_display_name: generateDisplayName(),
    helper_is_verified: true, // Demo helper is always "verified"
    shared_topics: sharedTopics.slice(0, 2),
  };
}

/**
 * Handle demo community matching (bypass real matching, auto-connect to PeerBot).
 */
async function handleDemoMatching(conversationId: string): Promise<void> {
  // Get conversation details
  const convResult = await query<{
    community_id: string;
    seeker_membership_id: string;
    topic: string | null;
    community_name: string;
  }>(
    `SELECT c.community_id, c.seeker_membership_id, c.topic, cm.name as community_name
     FROM conversations c
     JOIN communities cm ON cm.id = c.community_id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convResult.rows.length === 0) return;
  const conv = convResult.rows[0];

  // Get seeker's topics and display name
  const [seekerTopics, seekerDisplayName] = await Promise.all([
    getSeekerTopics(conv.seeker_membership_id),
    getSeekerDisplayName(conv.seeker_membership_id),
  ]);

  // Generate fake connection data
  const connectionData = generateDemoConnectionData(seekerTopics, conv.topic, seekerDisplayName);

  // Simulated matching delay: 3-5 seconds
  const delay = Math.floor(Math.random() * 2000) + 3000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Update conversation to active with match score
  await query(
    `UPDATE conversations SET status = 'active', match_score = $1 WHERE id = $2`,
    [connectionData.match_score, conversationId]
  );

  // Emit demo_match_found event with connection data
  console.log(`[MATCHING] Emitting demo_match_found for conversation ${conversationId}`);
  emitToConversation(conversationId, 'demo_match_found', {
    conversationId,
    connection_data: connectionData,
  });

  // Delay to let frontend process demo_match_found and show connection card
  // before PeerBot greeting arrives
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate PeerBot greeting using demo helper persona
  const greetingContent = await generatePeerBotResponse(
    [{ content: 'Hello, I need someone to talk to.', sender_email: null, is_peerbot: false }],
    { topic: conv.topic, community_name: conv.community_name },
    { isDemo: true }
  );

  // Insert PeerBot message with demo_helper marker
  const msgResult = await query<{
    id: string;
    conversation_id: string;
    sender_membership_id: string | null;
    content: string;
    created_at: Date;
    moderation_result: { sender?: string; demo_helper?: boolean } | null;
  }>(
    `INSERT INTO messages (conversation_id, sender_membership_id, content, moderation_result)
     VALUES ($1, NULL, $2, $3)
     RETURNING *`,
    [conversationId, greetingContent, JSON.stringify({ sender: 'peerbot', demo_helper: true })]
  );

  const peerBotMessage = msgResult.rows[0];

  // Emit the greeting message
  emitToConversation(conversationId, 'new_message', {
    ...peerBotMessage,
    sender_email: null,
  });
}

// =============================================================================
// DEMO HELPER SIMULATION (Wave 3)
// When a helper toggles available in demo community, simulate a pending request
// =============================================================================

// Track active demo helper simulations (prevent duplicates)
const activeDemoHelperSimulations = new Map<string, NodeJS.Timeout>();

/**
 * Start demo helper simulation when helper goes available in demo community.
 * After 10-15s delay, generates a fake pending request.
 */
export async function startDemoHelperSimulation(
  userId: string,
  communityId: string,
  membershipId: string
): Promise<void> {
  // Cancel any existing simulation for this user
  cancelDemoHelperSimulation(userId);

  // Random delay: 10-15 seconds
  const delay = Math.floor(Math.random() * 5000) + 10000;

  console.log(`[DEMO] Starting helper simulation for user ${userId}, delay: ${delay}ms`);

  const timeout = setTimeout(async () => {
    try {
      await createDemoSeekerConversation(userId, communityId, membershipId);
    } catch (err) {
      console.error('[DEMO] Error creating demo seeker conversation:', err);
    }
    activeDemoHelperSimulations.delete(userId);
  }, delay);

  activeDemoHelperSimulations.set(userId, timeout);
}

/**
 * Cancel any pending demo helper simulation for a user.
 */
export function cancelDemoHelperSimulation(userId: string): void {
  const timeout = activeDemoHelperSimulations.get(userId);
  if (timeout) {
    clearTimeout(timeout);
    activeDemoHelperSimulations.delete(userId);
    console.log(`[DEMO] Cancelled helper simulation for user ${userId}`);
  }
}

/**
 * Create a demo seeker conversation and notify the helper.
 */
async function createDemoSeekerConversation(
  helperUserId: string,
  communityId: string,
  _helperMembershipId: string
): Promise<void> {
  // 1. Get community config for topics
  const communityResult = await query<{ config: { topics?: string[] } }>(
    'SELECT config FROM communities WHERE id = $1',
    [communityId]
  );
  const topics = communityResult.rows[0]?.config?.topics || ['General Support'];

  // 2. Pick random topic
  const topic = topics[Math.floor(Math.random() * topics.length)];

  // 3. Generate fake seeker display name
  const seekerDisplayName = generateDisplayName();

  // 4. Random match score: 70-90%
  const matchScore = Math.floor(Math.random() * 21) + 70;

  // 5. Create a demo seeker conversation record
  const convResult = await query<{ id: string }>(
    `INSERT INTO conversations (community_id, seeker_membership_id, topic, status, match_score, is_demo_seeker)
     VALUES ($1, NULL, $2, 'matching', $3, true)
     RETURNING id`,
    [communityId, topic, matchScore]
  );
  const conversationId = convResult.rows[0].id;

  // 6. Emit help_request to the helper
  const event: HelpRequestEvent = {
    conversationId,
    communityId,
    topic,
    matchScore,
    startedAt: new Date().toISOString(),
  };
  emitToUser(helperUserId, 'help_request', event);

  console.log(`[DEMO] Created demo seeker conversation ${conversationId} for helper ${helperUserId} (topic: ${topic}, score: ${matchScore}%, seeker: ${seekerDisplayName})`);
}

/**
 * Handle when a helper accepts a demo seeker conversation.
 * Sends the initial message from the simulated seeker.
 */
export async function handleDemoSeekerJoined(
  conversationId: string,
  topic: string | null,
  communityName: string
): Promise<void> {
  // Small delay before first message
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate opening message from demo seeker
  const openingMessage = await generatePeerBotResponse(
    [], // Empty - this is the first message
    { topic, community_name: communityName },
    { isDemoSeeker: true }
  );

  // Insert message
  const msgResult = await query<{ id: string; conversation_id: string; sender_membership_id: string | null; content: string; created_at: Date; moderation_result: object | null }>(
    `INSERT INTO messages (conversation_id, sender_membership_id, content, moderation_result)
     VALUES ($1, NULL, $2, $3)
     RETURNING *`,
    [conversationId, openingMessage, JSON.stringify({ sender: 'peerbot', demo_seeker: true })]
  );

  // Emit message
  emitToConversation(conversationId, 'new_message', {
    ...msgResult.rows[0],
    sender_email: null,
  });

  console.log(`[DEMO] Sent demo seeker opening message for conversation ${conversationId}`);
}

// =============================================================================
// HELPER NOTIFICATION
// =============================================================================

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

  // Check if this is a demo community - bypass real matching
  if (await isDemoCommunity(community_id)) {
    console.log(`[MATCHING] Demo community detected for conversation ${conversationId}, bypassing real matching`);
    await handleDemoMatching(conversationId);
    return;
  }

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
