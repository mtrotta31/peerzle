import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { getTopicsForCommunity } from '../data/community-topics';
import { generateDisplayName } from '../data/display-names';

const router = Router();

interface MembershipRow {
  id: string;
  onboarding_completed: boolean;
  display_name: string | null;
  role: string;
}

// Helper to get membership for user in community
async function getMembership(userId: string, communitySlug: string): Promise<MembershipRow | null> {
  const result = await query<MembershipRow>(
    `SELECT m.id, m.onboarding_completed, m.display_name, m.role
     FROM memberships m
     JOIN communities c ON m.community_id = c.id
     WHERE m.user_id = $1 AND c.slug = $2`,
    [userId, communitySlug]
  );
  return result.rows[0] || null;
}

// GET /api/onboarding/:communitySlug/status
router.get('/:communitySlug/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const membership = await getMembership(req.user!.userId, communitySlug);

    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    res.json({
      onboardingCompleted: membership.onboarding_completed,
      displayName: membership.display_name,
    });
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
});

// GET /api/onboarding/:communitySlug/topics
router.get('/:communitySlug/topics', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;

    // Verify user has membership
    const membership = await getMembership(req.user!.userId, communitySlug);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const topics = getTopicsForCommunity(communitySlug);
    res.json({ topics });
  } catch (error) {
    console.error('Error getting community topics:', error);
    res.status(500).json({ error: 'Failed to get topics' });
  }
});

// POST /api/onboarding/:communitySlug/generate-name
router.post('/:communitySlug/generate-name', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;

    // Verify user has membership
    const membership = await getMembership(req.user!.userId, communitySlug);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const displayName = generateDisplayName();
    res.json({ displayName });
  } catch (error) {
    console.error('Error generating display name:', error);
    res.status(500).json({ error: 'Failed to generate display name' });
  }
});

// POST /api/onboarding/:communitySlug/complete
router.post('/:communitySlug/complete', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const { displayName, topics, demographics, role } = req.body;

    // Validate inputs
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      res.status(400).json({ error: 'Display name is required' });
      return;
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({ error: 'At least one topic must be selected' });
      return;
    }

    if (!role || !['seeker', 'both'].includes(role)) {
      res.status(400).json({ error: 'Role must be either "seeker" or "both"' });
      return;
    }

    // Validate each topic has valid ratings
    for (const topic of topics) {
      if (!topic.topic || typeof topic.topic !== 'string') {
        res.status(400).json({ error: 'Each topic must have a name' });
        return;
      }
      if (!Number.isInteger(topic.historyRating) || topic.historyRating < 1 || topic.historyRating > 10) {
        res.status(400).json({ error: 'History rating must be between 1 and 10' });
        return;
      }
      if (!Number.isInteger(topic.knowledgeRating) || topic.knowledgeRating < 1 || topic.knowledgeRating > 10) {
        res.status(400).json({ error: 'Knowledge rating must be between 1 and 10' });
        return;
      }
      if (!Number.isInteger(topic.copingRating) || topic.copingRating < 1 || topic.copingRating > 10) {
        res.status(400).json({ error: 'Coping rating must be between 1 and 10' });
        return;
      }
    }

    // Get membership
    const membership = await getMembership(req.user!.userId, communitySlug);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    // Determine the role to set
    // Preserve admin role - admins should keep their role regardless of onboarding choice
    let newRole: string;
    if (membership.role === 'admin') {
      newRole = 'admin';
    } else {
      newRole = role === 'both' ? 'both' : 'seeker';
    }

    // Update membership with display name, profile, role, and mark onboarding complete
    await query(
      `UPDATE memberships
       SET display_name = $1,
           profile = $2,
           role = $3,
           onboarding_completed = true
       WHERE id = $4`,
      [
        displayName.trim(),
        JSON.stringify(demographics || {}),
        newRole,
        membership.id,
      ]
    );

    // Delete any existing topics for this membership (in case of re-onboarding)
    await query(
      'DELETE FROM user_experience_topics WHERE membership_id = $1',
      [membership.id]
    );

    // Insert all selected topics with ratings
    for (const topic of topics) {
      await query(
        `INSERT INTO user_experience_topics
         (membership_id, topic, history_rating, knowledge_rating, coping_rating)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          membership.id,
          topic.topic,
          topic.historyRating,
          topic.knowledgeRating,
          topic.copingRating,
        ]
      );
    }

    res.json({
      success: true,
      displayName: displayName.trim(),
      topicsCount: topics.length,
      role: newRole,
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
