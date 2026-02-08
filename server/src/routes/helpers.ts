import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { emitToConversation } from '../config/socket';
import { cancelMatchingProcess } from '../services/matching-queue';
import { calculateMatchScore } from '../services/matching';
import { sendPushNotification } from '../services/push-notifications';

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
  seeker_org_id: string | null;
  seeker_org_name: string | null;
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
    // Include seeker's organization info
    const result = await query<ConversationRow>(
      `SELECT c.id, c.community_id, c.seeker_membership_id, c.helper_membership_id,
              c.topic, c.status, c.started_at, c.ended_at,
              cm.slug as community_slug, cm.name as community_name,
              COALESCE(seeker_m.display_name, 'Anonymous') as seeker_name,
              seeker_m.organization_id as seeker_org_id,
              seeker_org.name as seeker_org_name
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.community_id = c.community_id AND m.user_id = $1
       JOIN memberships seeker_m ON seeker_m.id = c.seeker_membership_id
       LEFT JOIN organizations seeker_org ON seeker_org.id = seeker_m.organization_id
       WHERE c.status = 'matching'
         AND c.helper_membership_id IS NULL
         AND m.is_available = true
         AND m.role IN ('helper', 'both')
         AND c.seeker_membership_id != m.id
       ORDER BY c.started_at ASC`,
      [userId]
    );

    console.log(`[HELPER] Found ${result.rows.length} pending conversations`);

    // Get this helper's membership to compute match scores and check org
    const membershipResult = await query<{ id: string; organization_id: string | null }>(
      `SELECT m.id, m.organization_id FROM memberships m
       WHERE m.user_id = $1
         AND m.is_available = true
         AND m.role IN ('helper', 'both')
       LIMIT 1`,
      [userId]
    );

    if (membershipResult.rows.length > 0 && result.rows.length > 0) {
      const helperMembershipId = membershipResult.rows[0].id;
      const helperOrgId = membershipResult.rows[0].organization_id;

      // Compute match scores and same-org flag for each pending conversation
      const pendingWithScores = await Promise.all(
        result.rows.map(async (conv) => {
          try {
            const score = await calculateMatchScore(
              helperMembershipId,
              conv.topic,
              conv.seeker_membership_id
            );
            const sameOrg = helperOrgId !== null && conv.seeker_org_id === helperOrgId;
            return {
              ...conv,
              match_score: score,
              same_org: sameOrg,
              org_name: conv.seeker_org_name,
            };
          } catch {
            return {
              ...conv,
              match_score: undefined,
              same_org: false,
              org_name: conv.seeker_org_name,
            };
          }
        })
      );

      res.json(pendingWithScores);
      return;
    }

    // Return with org info but no match scores
    const pendingWithOrg = result.rows.map((conv) => ({
      ...conv,
      same_org: false,
      org_name: conv.seeker_org_name,
    }));

    res.json(pendingWithOrg);
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

    // Update conversation with helper - use conditional UPDATE for race condition protection
    const updateResult = await query<ConversationRow>(
      `UPDATE conversations
       SET helper_membership_id = $1, status = 'active'
       WHERE id = $2 AND status = 'matching' AND helper_membership_id IS NULL
       RETURNING *`,
      [membership.id, conversationId]
    );

    if (updateResult.rows.length === 0) {
      res.status(409).json({ error: 'Conversation was already accepted by another helper' });
      return;
    }

    // Cancel the matching process
    cancelMatchingProcess(conversationId);

    // Compute and persist match score
    try {
      const matchScore = await calculateMatchScore(
        membership.id,
        conversation.topic,
        conversation.seeker_membership_id
      );
      await query(
        `UPDATE conversations SET match_score = $1 WHERE id = $2`,
        [matchScore, conversationId]
      );
    } catch (err) {
      console.error('Failed to persist match score:', err);
    }

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

    // Send push notification to the seeker
    // Get seeker's user_id from their membership
    const seekerResult = await query<{ user_id: string }>(
      'SELECT user_id FROM memberships WHERE id = $1',
      [conversation.seeker_membership_id]
    );
    if (seekerResult.rows.length > 0) {
      const seekerUserId = seekerResult.rows[0].user_id;
      sendPushNotification(seekerUserId, {
        title: "You've been matched!",
        body: 'A peer supporter is ready to chat with you.',
        data: {
          url: `/community/${conversation.community_slug}/chat/${conversationId}`,
          type: 'match_accepted',
          conversationId,
        },
      }).catch((err) => {
        console.error('[HELPER] Push notification error:', err);
      });
    }

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
