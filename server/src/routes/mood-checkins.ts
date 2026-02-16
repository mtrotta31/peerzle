import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/database';
import { checkAndTriggerMoodNudge } from '../services/mood-nudge';

const router = Router();

// POST /api/mood-checkins - Submit a standalone mood check-in
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { mood_score, community_id, note } = req.body;

    // Validate mood_score
    if (!mood_score || mood_score < 1 || mood_score > 5) {
      res.status(400).json({ error: 'mood_score must be between 1 and 5' });
      return;
    }

    // Validate community_id
    if (!community_id) {
      res.status(400).json({ error: 'community_id is required' });
      return;
    }

    // Get user's membership for this community to find organization_id
    const membershipResult = await query(
      `SELECT m.organization_id
       FROM memberships m
       WHERE m.user_id = $1 AND m.community_id = $2`,
      [userId, community_id]
    );

    if (membershipResult.rows.length === 0) {
      res.status(403).json({ error: 'Not a member of this community' });
      return;
    }

    const organizationId = membershipResult.rows[0].organization_id;

    // Insert the mood check-in
    const insertResult = await query(
      `INSERT INTO mood_checkins (user_id, community_id, organization_id, mood_score, source, note)
       VALUES ($1, $2, $3, $4, 'standalone', $5)
       RETURNING id, mood_score, created_at`,
      [userId, community_id, organizationId, mood_score, note || null]
    );

    const checkIn = insertResult.rows[0];

    // Get current streak
    const streakResult = await calculateStreak(userId, community_id);

    // Check if we should send a PeerBot nudge (3 consecutive "Much Worse")
    // Run async - don't wait for it
    checkAndTriggerMoodNudge(userId, community_id).catch(err => {
      console.error('Failed to check mood nudge:', err);
    });

    res.status(201).json({
      id: checkIn.id,
      mood_score: checkIn.mood_score,
      created_at: checkIn.created_at,
      streak: streakResult.current_streak,
    });
  } catch (error) {
    console.error('Mood check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/mood-checkins/me - Get current user's mood history
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const communityId = req.query.community_id as string;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);

    if (!communityId) {
      res.status(400).json({ error: 'community_id query parameter is required' });
      return;
    }

    const result = await query(
      `SELECT id, mood_score, source, note, created_at
       FROM mood_checkins
       WHERE user_id = $1 AND community_id = $2 AND created_at >= NOW() - INTERVAL '${days} days'
       ORDER BY created_at DESC`,
      [userId, communityId]
    );

    res.json({
      checkins: result.rows,
      period_days: days,
    });
  } catch (error) {
    console.error('Get mood history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/mood-checkins/streak - Get current user's check-in streak
router.get('/streak', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const communityId = req.query.community_id as string;

    if (!communityId) {
      res.status(400).json({ error: 'community_id query parameter is required' });
      return;
    }

    const streakData = await calculateStreak(userId, communityId);

    res.json(streakData);
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/mood-checkins/today - Check if user already checked in today
router.get('/today', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const communityId = req.query.community_id as string;

    if (!communityId) {
      res.status(400).json({ error: 'community_id query parameter is required' });
      return;
    }

    const result = await query(
      `SELECT id, mood_score, source, created_at
       FROM mood_checkins
       WHERE user_id = $1 AND community_id = $2 AND DATE(created_at) = CURRENT_DATE
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, communityId]
    );

    if (result.rows.length > 0) {
      res.json({
        checked_in: true,
        check_in: result.rows[0],
      });
    } else {
      res.json({
        checked_in: false,
      });
    }
  } catch (error) {
    console.error('Get today check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate streak
async function calculateStreak(userId: string, communityId: string): Promise<{
  current_streak: number;
  longest_streak: number;
  checked_in_today: boolean;
}> {
  // Get all check-in dates for the user in this community (last 365 days)
  const result = await query(
    `SELECT DISTINCT DATE(created_at) as check_date
     FROM mood_checkins
     WHERE user_id = $1 AND community_id = $2 AND created_at >= NOW() - INTERVAL '365 days'
     ORDER BY check_date DESC`,
    [userId, communityId]
  );

  if (result.rows.length === 0) {
    return { current_streak: 0, longest_streak: 0, checked_in_today: false };
  }

  const dates = result.rows.map(row => new Date(row.check_date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkedInToday = dates[0].toDateString() === today.toDateString();

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = checkedInToday ? today : new Date(today.getTime() - 86400000); // Start from today or yesterday

  for (const date of dates) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.toDateString() === checkDate.toDateString()) {
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - 86400000); // Go back one day
    } else if (dateOnly < checkDate) {
      break; // Gap in streak
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  // Sort dates ascending for longest streak calculation
  const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime());

  for (const date of sortedDates) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const diffDays = Math.round((dateOnly.getTime() - prevDate.getTime()) / 86400000);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    prevDate = dateOnly;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    checked_in_today: checkedInToday,
  };
}

export default router;
