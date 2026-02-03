import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface RatingRow {
  id: string;
  conversation_id: string;
  membership_id: string;
  role: 'seeker' | 'helper';
  rating: number;
  felt_heard: boolean | null;
  would_recommend: boolean | null;
  feedback_text: string | null;
  created_at: Date;
}

interface ConversationParticipant {
  membership_id: string;
  role: 'seeker' | 'helper';
}

// POST /api/ratings - Submit a rating for a conversation
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversationId, rating, role, feltHeard, wouldRecommend, feedbackText } = req.body;

    // Validate required fields
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' });
      return;
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating must be a number between 1 and 5' });
      return;
    }

    if (!role || !['seeker', 'helper'].includes(role)) {
      res.status(400).json({ error: 'role must be either "seeker" or "helper"' });
      return;
    }

    // Verify the user is a participant in the conversation with the claimed role
    const participantResult = await query<ConversationParticipant>(
      `SELECT
        CASE
          WHEN c.seeker_membership_id = m.id THEN c.seeker_membership_id
          WHEN c.helper_membership_id = m.id THEN c.helper_membership_id
        END as membership_id,
        CASE
          WHEN c.seeker_membership_id = m.id THEN 'seeker'
          WHEN c.helper_membership_id = m.id THEN 'helper'
        END as role
       FROM conversations c
       JOIN memberships m ON (m.id = c.seeker_membership_id OR m.id = c.helper_membership_id)
       WHERE c.id = $1 AND m.user_id = $2`,
      [conversationId, userId]
    );

    if (participantResult.rows.length === 0) {
      res.status(403).json({ error: 'You are not a participant in this conversation' });
      return;
    }

    const participant = participantResult.rows[0];

    // Verify the claimed role matches the actual role
    if (participant.role !== role) {
      res.status(400).json({ error: `Invalid role. You are the ${participant.role} in this conversation` });
      return;
    }

    // Check for existing rating
    const existingRating = await query<RatingRow>(
      'SELECT id FROM conversation_ratings WHERE conversation_id = $1 AND membership_id = $2',
      [conversationId, participant.membership_id]
    );

    if (existingRating.rows.length > 0) {
      res.status(409).json({ error: 'You have already submitted a rating for this conversation' });
      return;
    }

    // Validate feltHeard is only provided for seekers
    const feltHeardValue = role === 'seeker' ? (feltHeard ?? null) : null;

    // Insert the rating
    const result = await query<RatingRow>(
      `INSERT INTO conversation_ratings
        (conversation_id, membership_id, role, rating, felt_heard, would_recommend, feedback_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        conversationId,
        participant.membership_id,
        role,
        rating,
        feltHeardValue,
        wouldRecommend ?? null,
        feedbackText || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ratings/:conversationId - Get the current user's rating for a conversation
router.get('/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversationId } = req.params;

    // Get the user's membership in the conversation
    const membershipResult = await query<{ id: string }>(
      `SELECT m.id
       FROM memberships m
       JOIN conversations c ON (m.id = c.seeker_membership_id OR m.id = c.helper_membership_id)
       WHERE c.id = $1 AND m.user_id = $2`,
      [conversationId, userId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'You are not a participant in this conversation' });
      return;
    }

    const membershipId = membershipResult.rows[0].id;

    // Get the rating
    const result = await query<RatingRow>(
      'SELECT * FROM conversation_ratings WHERE conversation_id = $1 AND membership_id = $2',
      [conversationId, membershipId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No rating found for this conversation' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
