import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../config/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Lazy initialization of Anthropic client
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

interface RecentMessage {
  content: string;
  sender_role: 'seeker' | 'helper' | 'peerbot';
}

interface FacilitatorResponse {
  suggestions: string[];
  tip: string;
}

interface ConversationInfo {
  topic: string | null;
  community_name: string;
}

function buildFacilitatorPrompt(context: ConversationInfo): string {
  const communityContext = context.community_name.toLowerCase().includes('first responder')
    ? `This is a First Responder Peer Support community. Be aware of unique stressors like trauma exposure, shift work, and the pressure to appear strong.`
    : '';

  return `You are a peer support facilitator helping a volunteer helper in a conversation with someone seeking support.

${communityContext}

The topic of this conversation is: ${context.topic || 'General support'}
The community is: ${context.community_name}

Based on the recent messages, provide:
1. Two brief suggested responses the helper could send (1-2 sentences each, empathetic and non-directive)
2. One relevant resource or technique tip (e.g., active listening reminder, grounding technique, when to suggest professional help)

Guidelines for suggestions:
- Use empathetic, validating language
- Avoid giving advice or trying to fix problems
- Focus on understanding and reflecting feelings
- Keep suggestions natural and conversational
- Never diagnose or recommend treatments

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"suggestions": ["suggestion 1", "suggestion 2"], "tip": "brief tip or resource"}`;
}

// POST /api/facilitator/suggestions - Get AI suggestions for helper
router.post('/suggestions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversationId, recentMessages } = req.body as {
      conversationId: string;
      recentMessages: RecentMessage[];
    };

    if (!conversationId) {
      res.status(400).json({ error: 'conversationId is required' });
      return;
    }

    if (!recentMessages || !Array.isArray(recentMessages) || recentMessages.length === 0) {
      res.status(400).json({ error: 'recentMessages array is required' });
      return;
    }

    // Verify user is the helper in this conversation
    const verifyResult = await query<ConversationInfo & { helper_user_id: string }>(
      `SELECT c.topic, cm.name as community_name, m.user_id as helper_user_id
       FROM conversations c
       JOIN communities cm ON cm.id = c.community_id
       JOIN memberships m ON m.id = c.helper_membership_id
       WHERE c.id = $1 AND c.status = 'active'`,
      [conversationId]
    );

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Active conversation not found' });
      return;
    }

    const conversation = verifyResult.rows[0];

    if (conversation.helper_user_id !== userId) {
      res.status(403).json({ error: 'Only the helper can access facilitator suggestions' });
      return;
    }

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Here are the recent messages in the conversation:\n\n${recentMessages
          .map((m) => `[${m.sender_role.toUpperCase()}]: ${m.content}`)
          .join('\n\n')}\n\nProvide suggestions for the helper.`,
      },
    ];

    // Call Claude API
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: buildFacilitatorPrompt({
        topic: conversation.topic,
        community_name: conversation.community_name,
      }),
      messages: claudeMessages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock?.text || '';

    // Parse JSON response
    try {
      const parsed = JSON.parse(responseText) as FacilitatorResponse;

      // Validate structure
      if (!Array.isArray(parsed.suggestions) || typeof parsed.tip !== 'string') {
        throw new Error('Invalid response structure');
      }

      res.json({
        suggestions: parsed.suggestions.slice(0, 2),
        tip: parsed.tip,
      });
    } catch (parseError) {
      console.error('Failed to parse facilitator response:', responseText);
      // Return fallback suggestions
      res.json({
        suggestions: [
          "It sounds like you're going through a lot right now. I'm here to listen.",
          "Thank you for sharing that with me. How are you feeling about it?",
        ],
        tip: "Remember to reflect back what you hear and validate their feelings before moving on.",
      });
    }
  } catch (error) {
    console.error('Facilitator suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
