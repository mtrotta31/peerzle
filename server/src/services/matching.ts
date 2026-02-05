import { query } from '../config/database';

export interface MatchResult {
  membershipId: string;
  userId: string;
  matchScore: number;
  displayName: string | null;
}

interface TopicRatings {
  history_rating: number;
  knowledge_rating: number;
  coping_rating: number;
}

/**
 * Calculate a match score (0-100) between a helper and a seeker's conversation request.
 *
 * Scoring components:
 * - Topic Match (40pts): Based on helper's self-ratings for the seeker's topic
 * - Experience Similarity (30pts): How similar helper and seeker ratings are on the topic
 * - Helper Rating (20pts): Average rating from past seekers
 * - Availability Recency (10pts): Default 5 (no timestamp tracking)
 */
export async function calculateMatchScore(
  helperMembershipId: string,
  seekerTopic: string | null,
  seekerMembershipId: string
): Promise<number> {
  let topicMatchScore = 0;
  let experienceSimilarityScore = 15; // default if no data
  let helperRatingScore = 10; // default if no ratings
  const availabilityRecencyScore = 5; // default, no tracking exists

  if (seekerTopic) {
    // Topic Match (40pts): Query helper's ratings for the seeker's topic
    const helperTopicResult = await query<TopicRatings>(
      `SELECT history_rating, knowledge_rating, coping_rating
       FROM user_experience_topics
       WHERE membership_id = $1 AND topic = $2`,
      [helperMembershipId, seekerTopic]
    );

    if (helperTopicResult.rows.length > 0) {
      const ht = helperTopicResult.rows[0];
      const avgRating = (ht.history_rating + ht.knowledge_rating + ht.coping_rating) / 3;
      topicMatchScore = (avgRating / 10) * 40;

      // Experience Similarity (30pts): Compare helper vs seeker on the same topic
      const seekerTopicResult = await query<TopicRatings>(
        `SELECT history_rating, knowledge_rating, coping_rating
         FROM user_experience_topics
         WHERE membership_id = $1 AND topic = $2`,
        [seekerMembershipId, seekerTopic]
      );

      if (seekerTopicResult.rows.length > 0) {
        const st = seekerTopicResult.rows[0];
        const historyDim = (1 - Math.abs(ht.history_rating - st.history_rating) / 9) * 10;
        const knowledgeDim = (1 - Math.abs(ht.knowledge_rating - st.knowledge_rating) / 9) * 10;
        const copingDim = (1 - Math.abs(ht.coping_rating - st.coping_rating) / 9) * 10;
        const avgDim = (historyDim + knowledgeDim + copingDim) / 3;
        experienceSimilarityScore = avgDim * 3;
      }
    }
  }

  // Helper Rating (20pts): Average rating from seekers who rated this helper
  const ratingResult = await query<{ avg_rating: number }>(
    `SELECT AVG(cr.rating)::float as avg_rating
     FROM conversation_ratings cr
     JOIN conversations c ON c.id = cr.conversation_id
     WHERE c.helper_membership_id = $1 AND cr.role = 'seeker'`,
    [helperMembershipId]
  );

  if (ratingResult.rows[0]?.avg_rating) {
    helperRatingScore = (ratingResult.rows[0].avg_rating / 5) * 20;
  }

  const totalScore = Math.round(
    topicMatchScore + experienceSimilarityScore + helperRatingScore + availabilityRecencyScore
  );

  return Math.min(100, Math.max(0, totalScore));
}

/**
 * Find and score all available helpers for a conversation, sorted by match score descending.
 */
export async function findMatchesForConversation(conversationId: string): Promise<MatchResult[]> {
  // Get conversation details
  const convResult = await query<{
    community_id: string;
    seeker_membership_id: string;
    topic: string | null;
  }>(
    `SELECT community_id, seeker_membership_id, topic FROM conversations WHERE id = $1`,
    [conversationId]
  );

  if (convResult.rows.length === 0) {
    return [];
  }

  const { community_id, seeker_membership_id, topic } = convResult.rows[0];

  // Get all available, qualified helpers in this community (excluding the seeker)
  const helpersResult = await query<{
    id: string;
    user_id: string;
    display_name: string | null;
  }>(
    `SELECT m.id, m.user_id, m.display_name
     FROM memberships m
     WHERE m.community_id = $1
       AND m.is_available = true
       AND m.role IN ('helper', 'both')
       AND m.training_completed = true
       AND m.onboarding_completed = true
       AND m.id != $2`,
    [community_id, seeker_membership_id]
  );

  // Score each helper
  const matches: MatchResult[] = [];
  for (const helper of helpersResult.rows) {
    const matchScore = await calculateMatchScore(helper.id, topic, seeker_membership_id);
    matches.push({
      membershipId: helper.id,
      userId: helper.user_id,
      matchScore,
      displayName: helper.display_name,
    });
  }

  // Sort by score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return matches;
}
