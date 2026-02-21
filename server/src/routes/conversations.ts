import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';
import { startMatchingProcess, cancelMatchingProcess, triggerPeerBotEarly } from '../services/matching-queue';

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
  match_score: number | null;
  seeker_pre_mood: number | null;
  seeker_post_mood: number | null;
  helper_compliment_badges: string[] | null;
  conversation_saved_by: string[] | null;
  is_demo_seeker: boolean;
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
    // If matching fails, update conversation status and notify seeker
    startMatchingProcess(newConversation.id).catch(async (err) => {
      console.error('Smart matching error for conversation', newConversation.id, ':', err);
      try {
        // Mark conversation as ended since matching failed
        await query(
          `UPDATE conversations SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [newConversation.id]
        );
        // Notify the seeker that matching failed
        emitToConversation(newConversation.id, 'matching_failed', {
          conversationId: newConversation.id,
          error: 'Unable to find a helper at this time. Please try again later.',
        });
      } catch (updateErr) {
        console.error('Failed to update conversation after matching error:', updateErr);
      }
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

    // Get active conversations with last message and peer display name
    const result = await query<ConversationRow & {
      community_slug: string;
      community_name: string;
      last_message: string | null;
      last_message_at: Date | null;
      peer_display_name: string | null;
      user_role: 'seeker' | 'helper';
    }>(
      `SELECT DISTINCT ON (c.id)
         c.*,
         cm.slug as community_slug,
         cm.name as community_name,
         latest_msg.content as last_message,
         latest_msg.created_at as last_message_at,
         CASE
           WHEN m.id = c.seeker_membership_id THEN helper_m.display_name
           ELSE seeker_m.display_name
         END as peer_display_name,
         CASE
           WHEN m.id = c.seeker_membership_id THEN 'seeker'
           ELSE 'helper'
         END as user_role
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON (m.id = c.seeker_membership_id OR m.id = c.helper_membership_id) AND m.user_id = $1
       LEFT JOIN memberships seeker_m ON seeker_m.id = c.seeker_membership_id
       LEFT JOIN memberships helper_m ON helper_m.id = c.helper_membership_id
       LEFT JOIN LATERAL (
         SELECT content, created_at
         FROM messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest_msg ON true
       WHERE c.status != 'ended'
       ORDER BY c.id, c.started_at DESC`,
      [userId]
    );

    // Re-sort by last_message_at or started_at (most recent first)
    const sorted = result.rows.sort((a, b) => {
      const aTime = a.last_message_at || a.started_at;
      const bTime = b.last_message_at || b.started_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    res.json(sorted);
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
    let conversationResult = await query<ConversationRow & { community_slug: string; community_name: string; is_demo: boolean }>(
      `SELECT c.*, cm.slug as community_slug, cm.name as community_name, cm.is_demo
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    // If not a participant, check if user is an admin of the conversation's community
    if (conversationResult.rows.length === 0) {
      conversationResult = await query<ConversationRow & { community_slug: string; community_name: string; is_demo: boolean }>(
        `SELECT c.*, cm.slug as community_slug, cm.name as community_name, cm.is_demo
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

    // Build connection_data when a helper has joined
    let connection_data = null;
    if (conversation.helper_membership_id) {
      // Get display names and verification status for both participants
      const participantsResult = await query<{
        id: string;
        display_name: string | null;
        is_verified_helper: boolean;
      }>(
        `SELECT id, display_name, is_verified_helper FROM memberships WHERE id = ANY($1)`,
        [[conversation.seeker_membership_id, conversation.helper_membership_id]]
      );

      const seekerMembership = participantsResult.rows.find(
        (r) => r.id === conversation.seeker_membership_id
      );
      const helperMembership = participantsResult.rows.find(
        (r) => r.id === conversation.helper_membership_id
      );

      // Find shared topics (topics both participants selected during onboarding)
      const sharedTopicsResult = await query<{ topic: string }>(
        `SELECT s.topic
         FROM user_experience_topics s
         JOIN user_experience_topics h ON h.topic = s.topic
         WHERE s.membership_id = $1 AND h.membership_id = $2
         ORDER BY s.topic ASC`,
        [conversation.seeker_membership_id, conversation.helper_membership_id]
      );

      connection_data = {
        match_score: conversation.match_score ?? null,
        seeker_display_name: seekerMembership?.display_name || null,
        helper_display_name: helperMembership?.display_name || null,
        helper_is_verified: helperMembership?.is_verified_helper || false,
        shared_topics: sharedTopicsResult.rows.map((r) => r.topic),
      };
    }

    const moodChange = (conversation.seeker_pre_mood != null && conversation.seeker_post_mood != null)
      ? conversation.seeker_post_mood - conversation.seeker_pre_mood
      : null;

    res.json({
      ...conversation,
      messages: messagesResult.rows,
      connection_data,
      mood_change: moodChange,
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

    // End conversation and get community info (including is_demo for demo CTA)
    const result = await query<ConversationRow & { community_slug: string; community_name: string; is_demo: boolean }>(
      `UPDATE conversations
       SET status = 'ended', ended_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *,
         (SELECT slug FROM communities WHERE id = conversations.community_id) as community_slug,
         (SELECT name FROM communities WHERE id = conversations.community_id) as community_name,
         (SELECT is_demo FROM communities WHERE id = conversations.community_id) as is_demo`,
      [id]
    );

    const endedConversation = result.rows[0];

    // Emit socket event to notify all participants
    emitToConversation(id, 'conversation_ended', {
      conversationId: id,
      endedBy: userId,
    });

    // Check if this was a demo seeker conversation - auto-submit rating and badges
    if (endedConversation.is_demo_seeker && endedConversation.helper_membership_id) {
      autoSubmitDemoSeekerRating(id, endedConversation.helper_membership_id).catch(err => {
        console.error('[DEMO] Auto-rating error:', err);
      });
    }

    res.json(endedConversation);
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/conversations/:id/pre-mood - Set seeker's pre-chat mood
router.put('/:id/pre-mood', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { mood } = req.body;
    const userId = req.user!.userId;

    if (!mood || mood < 1 || mood > 5 || !Number.isInteger(mood)) {
      res.status(400).json({ error: 'Mood must be an integer between 1 and 5' });
      return;
    }

    // Verify user is the seeker and get membership details
    const convResult = await query<ConversationRow & { organization_id: string | null }>(
      `SELECT c.*, m.organization_id FROM conversations c
       JOIN memberships m ON m.id = c.seeker_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found or you are not the seeker' });
      return;
    }

    const conversation = convResult.rows[0];
    if (conversation.status !== 'matching' && conversation.status !== 'active') {
      res.status(400).json({ error: 'Mood can only be set during matching or active conversations' });
      return;
    }

    const updateResult = await query<ConversationRow>(
      `UPDATE conversations SET seeker_pre_mood = $1 WHERE id = $2 RETURNING *`,
      [mood, id]
    );

    // Also write to mood_checkins table for unified mood tracking
    await query(
      `INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source)
       VALUES ($1, $2, $3, $4, 'conversation')`,
      [userId, conversation.community_id, conversation.organization_id, mood]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Set pre-mood error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/conversations/:id/post-mood - Set seeker's post-chat mood and helper badges
router.put('/:id/post-mood', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { mood, badges } = req.body;
    const userId = req.user!.userId;

    if (!mood || mood < 1 || mood > 5 || !Number.isInteger(mood)) {
      res.status(400).json({ error: 'Mood must be an integer between 1 and 5' });
      return;
    }

    // Verify user is the seeker
    const convResult = await query<ConversationRow>(
      `SELECT c.* FROM conversations c
       JOIN memberships m ON m.id = c.seeker_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    if (convResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found or you are not the seeker' });
      return;
    }

    const conversation = convResult.rows[0];
    if (conversation.status !== 'ended') {
      res.status(400).json({ error: 'Post-mood can only be set after conversation has ended' });
      return;
    }

    const badgesArray = Array.isArray(badges) ? badges : null;

    const updateResult = await query<ConversationRow>(
      `UPDATE conversations SET seeker_post_mood = $1, helper_compliment_badges = $2 WHERE id = $3 RETURNING *`,
      [mood, badgesArray, id]
    );

    const updated = updateResult.rows[0];
    const moodChange = updated.seeker_pre_mood != null ? mood - updated.seeker_pre_mood : null;

    res.json({ ...updated, mood_change: moodChange });
  } catch (error) {
    console.error('Set post-mood error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/start-peerbot - Trigger PeerBot early (seeker's choice while waiting)
router.post('/:id/start-peerbot', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify user is the seeker and conversation is still matching
    const verifyResult = await query<ConversationRow>(
      `SELECT c.* FROM conversations c
       JOIN memberships m ON m.id = c.seeker_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found or you are not the seeker' });
      return;
    }

    const conversation = verifyResult.rows[0];

    if (conversation.status !== 'matching') {
      res.status(400).json({ error: 'PeerBot can only be started during matching' });
      return;
    }

    if (conversation.helper_membership_id !== null) {
      res.status(400).json({ error: 'A helper has already joined' });
      return;
    }

    // Trigger PeerBot early
    await triggerPeerBotEarly(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Start PeerBot early error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/conversations/:id/save - Save conversation for personal reflection
router.post('/:id/save', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verify user is a participant
    const verifyResult = await query(
      `SELECT c.id FROM conversations c
       JOIN memberships m ON m.id = c.seeker_membership_id OR m.id = c.helper_membership_id
       WHERE c.id = $1 AND m.user_id = $2`,
      [id, userId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Add user to saved_by array (using array_append + COALESCE for null safety)
    await query(
      `UPDATE conversations
       SET conversation_saved_by = array_append(COALESCE(conversation_saved_by, ARRAY[]::uuid[]), $1::uuid)
       WHERE id = $2
         AND NOT ($1::uuid = ANY(COALESCE(conversation_saved_by, ARRAY[]::uuid[])))`,
      [userId, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Auto-submit rating and compliment badges for demo seeker conversations.
 * Called when helper ends a demo seeker conversation.
 */
async function autoSubmitDemoSeekerRating(
  conversationId: string,
  _helperMembershipId: string
): Promise<void> {
  // Delay to simulate natural timing (rating usually comes after conversation ends)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Random positive rating (4-5 stars, weighted towards 5)
  const rating = Math.random() > 0.3 ? 5 : 4;

  // Pick 1-2 random badges
  const allBadges = ['great_listener', 'helpful_advice', 'felt_heard', 'above_beyond', 'easy_to_talk', 'understood_me'];
  const shuffled = [...allBadges].sort(() => Math.random() - 0.5);
  const selectedBadges = shuffled.slice(0, Math.random() > 0.5 ? 2 : 1);

  // Insert rating (from demo seeker's perspective - no membership_id since seeker is simulated)
  await query(
    `INSERT INTO conversation_ratings (conversation_id, membership_id, role, rating, felt_heard, would_recommend)
     VALUES ($1, NULL, 'seeker', $2, true, true)
     ON CONFLICT DO NOTHING`,
    [conversationId, rating]
  );

  // Set badges on conversation
  await query(
    `UPDATE conversations SET helper_compliment_badges = $1, seeker_post_mood = 4 WHERE id = $2`,
    [selectedBadges, conversationId]
  );

  console.log(`[DEMO] Auto-submitted rating ${rating} stars with badges: ${selectedBadges.join(', ')} for conversation ${conversationId}`);
}

export default router;
