import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { trainingModules, getModule, calculateScore, PASSING_SCORE } from '../data/training-content';

const router = Router();

interface MembershipRow {
  id: string;
  training_completed: boolean;
}

interface TrainingProgressRow {
  module_number: number;
  completed_at: Date;
  score: number;
}

interface CommunityRow {
  id: string;
}

// GET /api/training/:communitySlug/status - Get training status for current user
router.get('/:communitySlug/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug } = req.params;
    const userId = req.user!.userId;

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get membership
    const membershipResult = await query<MembershipRow>(
      'SELECT id, training_completed FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    const membership = membershipResult.rows[0];

    // Get completed modules
    const progressResult = await query<TrainingProgressRow>(
      `SELECT module_number, completed_at, score
       FROM helper_training_progress
       WHERE membership_id = $1
       ORDER BY module_number`,
      [membership.id]
    );

    const completedModules = progressResult.rows.map(row => ({
      moduleNumber: row.module_number,
      completedAt: row.completed_at,
      score: row.score,
    }));

    // Build module overview
    const modules = trainingModules.map(m => {
      const completed = completedModules.find(c => c.moduleNumber === m.moduleNumber);
      return {
        moduleNumber: m.moduleNumber,
        title: m.title,
        description: m.description,
        isCompleted: !!completed,
        completedAt: completed?.completedAt || null,
        score: completed?.score || null,
      };
    });

    res.json({
      trainingCompleted: membership.training_completed,
      modules,
      totalModules: trainingModules.length,
      completedCount: completedModules.length,
    });
  } catch (error) {
    console.error('Get training status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/training/:communitySlug/module/:moduleNumber - Get module content
router.get('/:communitySlug/module/:moduleNumber', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, moduleNumber } = req.params;
    const userId = req.user!.userId;
    const moduleNum = parseInt(moduleNumber, 10);

    if (isNaN(moduleNum) || moduleNum < 1 || moduleNum > 3) {
      res.status(400).json({ error: 'Invalid module number' });
      return;
    }

    // Verify membership
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const membershipResult = await query<MembershipRow>(
      'SELECT id FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityResult.rows[0].id]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    // Get module content
    const module = getModule(moduleNum);
    if (!module) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    // Check if already completed
    const progressResult = await query<TrainingProgressRow>(
      'SELECT score, completed_at FROM helper_training_progress WHERE membership_id = $1 AND module_number = $2',
      [membershipResult.rows[0].id, moduleNum]
    );

    const isCompleted = progressResult.rows.length > 0;

    // Return module content (without correct answers for security)
    res.json({
      moduleNumber: module.moduleNumber,
      title: module.title,
      description: module.description,
      lessonContent: module.lessonContent,
      questions: module.questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
      })),
      isCompleted,
      score: isCompleted ? progressResult.rows[0].score : null,
      completedAt: isCompleted ? progressResult.rows[0].completed_at : null,
      passingScore: PASSING_SCORE,
    });
  } catch (error) {
    console.error('Get training module error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/training/:communitySlug/module/:moduleNumber/complete - Complete a module
router.post('/:communitySlug/module/:moduleNumber/complete', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { communitySlug, moduleNumber } = req.params;
    const { answers } = req.body;
    const userId = req.user!.userId;
    const moduleNum = parseInt(moduleNumber, 10);

    if (isNaN(moduleNum) || moduleNum < 1 || moduleNum > 3) {
      res.status(400).json({ error: 'Invalid module number' });
      return;
    }

    if (!Array.isArray(answers) || answers.length !== 4) {
      res.status(400).json({ error: 'Must provide 4 answers' });
      return;
    }

    // Get community
    const communityResult = await query<CommunityRow>(
      'SELECT id FROM communities WHERE slug = $1 AND is_active = true',
      [communitySlug]
    );

    if (communityResult.rows.length === 0) {
      res.status(404).json({ error: 'Community not found' });
      return;
    }

    const communityId = communityResult.rows[0].id;

    // Get membership
    const membershipResult = await query<MembershipRow>(
      'SELECT id, training_completed FROM memberships WHERE user_id = $1 AND community_id = $2',
      [userId, communityId]
    );

    if (membershipResult.rows.length === 0) {
      res.status(404).json({ error: 'Not a member of this community' });
      return;
    }

    const membership = membershipResult.rows[0];

    // Calculate score
    const score = calculateScore(moduleNum, answers);
    const passed = score >= PASSING_SCORE;

    // Get the module for feedback
    const module = getModule(moduleNum);
    if (!module) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    // Build detailed results
    const results = module.questions.map((q, index) => ({
      questionId: q.id,
      question: q.question,
      selectedAnswer: answers[index],
      correctAnswer: q.correctIndex,
      isCorrect: answers[index] === q.correctIndex,
      explanation: q.explanation,
    }));

    if (passed) {
      // Save or update progress
      await query(
        `INSERT INTO helper_training_progress (membership_id, module_number, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (membership_id, module_number)
         DO UPDATE SET score = $3, completed_at = CURRENT_TIMESTAMP`,
        [membership.id, moduleNum, score]
      );

      // Check if all modules are now complete
      const allProgressResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM helper_training_progress WHERE membership_id = $1',
        [membership.id]
      );

      const completedCount = parseInt(allProgressResult.rows[0].count, 10);
      const allComplete = completedCount >= 3;

      if (allComplete && !membership.training_completed) {
        await query(
          'UPDATE memberships SET training_completed = true WHERE id = $1',
          [membership.id]
        );
        console.log(`[TRAINING] User ${userId} completed all training modules in ${communitySlug}`);
      }

      console.log(`[TRAINING] User ${userId} passed module ${moduleNum} with score ${score}% in ${communitySlug}`);

      res.json({
        passed: true,
        score,
        passingScore: PASSING_SCORE,
        results,
        allModulesComplete: allComplete,
      });
    } else {
      console.log(`[TRAINING] User ${userId} failed module ${moduleNum} with score ${score}% in ${communitySlug}`);

      res.json({
        passed: false,
        score,
        passingScore: PASSING_SCORE,
        results,
        message: 'You need 75% (3 of 4 correct) to pass. Please review the lesson and try again.',
      });
    }
  } catch (error) {
    console.error('Complete training module error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
