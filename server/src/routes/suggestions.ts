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

// Separate rate limit maps: suggestions (10s) vs coaching (15s)
const suggestionsLastRequest = new Map<string, number>();
const coachingLastRequest = new Map<string, number>();

const SUGGESTIONS_COOLDOWN_MS = 10000;
const COACHING_COOLDOWN_MS = 15000;

interface RecentMessage {
  role: 'seeker' | 'helper' | 'peerbot';
  content: string;
}

// POST /api/suggestions/generate
router.post('/generate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { conversation_id, recent_messages, mode } = req.body as {
      conversation_id: string;
      recent_messages: RecentMessage[];
      mode: 'helper' | 'seeker' | 'coaching';
    };

    if (!conversation_id) {
      res.status(400).json({ error: 'conversation_id is required' });
      return;
    }

    if (!mode || (mode !== 'helper' && mode !== 'seeker' && mode !== 'coaching')) {
      res.status(400).json({ error: 'mode must be "helper", "seeker", or "coaching"' });
      return;
    }

    if (!recent_messages || !Array.isArray(recent_messages)) {
      res.status(400).json({ error: 'recent_messages array is required' });
      return;
    }

    // Rate limiting with separate cooldowns
    const now = Date.now();
    if (mode === 'coaching') {
      const lastTime = coachingLastRequest.get(conversation_id);
      if (lastTime && now - lastTime < COACHING_COOLDOWN_MS) {
        const retryAfter = COACHING_COOLDOWN_MS - (now - lastTime);
        res.status(429).json({ error: 'Rate limited', retryAfter });
        return;
      }
      coachingLastRequest.set(conversation_id, now);
    } else {
      const lastTime = suggestionsLastRequest.get(conversation_id);
      if (lastTime && now - lastTime < SUGGESTIONS_COOLDOWN_MS) {
        const retryAfter = SUGGESTIONS_COOLDOWN_MS - (now - lastTime);
        res.status(429).json({ error: 'Rate limited', retryAfter });
        return;
      }
      suggestionsLastRequest.set(conversation_id, now);
    }

    // Coaching mode always verifies as helper
    const participantMode = mode === 'coaching' ? 'helper' : mode;

    const verifySQL = participantMode === 'helper'
      ? `SELECT c.topic, cm.name as community_name, c.status, m.user_id as participant_user_id
         FROM conversations c
         JOIN communities cm ON cm.id = c.community_id
         JOIN memberships m ON m.id = c.helper_membership_id
         WHERE c.id = $1`
      : `SELECT c.topic, cm.name as community_name, c.status, m.user_id as participant_user_id
         FROM conversations c
         JOIN communities cm ON cm.id = c.community_id
         JOIN memberships m ON m.id = c.seeker_membership_id
         WHERE c.id = $1`;

    const verifyResult = await query<{
      topic: string | null;
      community_name: string;
      status: string;
      participant_user_id: string;
    }>(verifySQL, [conversation_id]);

    if (verifyResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = verifyResult.rows[0];

    if (conversation.status !== 'active') {
      res.status(400).json({ error: 'Conversation is not active' });
      return;
    }

    if (conversation.participant_user_id !== userId) {
      res.status(403).json({ error: 'Not authorized for this conversation' });
      return;
    }

    // Build system prompt based on mode
    let systemPrompt: string;
    if (mode === 'coaching') {
      systemPrompt = buildCoachingSystemPrompt();
    } else if (mode === 'helper') {
      systemPrompt = buildHelperSystemPrompt();
    } else {
      systemPrompt = buildSeekerSystemPrompt();
    }

    // Build user message
    const messagesContext = recent_messages
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    let userMessage: string;
    if (mode === 'coaching') {
      userMessage = `The seeker's topic is ${conversation.topic || 'General support'}. Here are the last messages:\n\n${messagesContext}\n\nProvide a coaching tip for the helper.`;
    } else if (mode === 'helper') {
      userMessage = `The seeker's topic is ${conversation.topic || 'General support'}. Here are the last messages:\n\n${messagesContext}\n\nGenerate 3 suggested responses for the helper.`;
    } else {
      userMessage = `The seeker's topic is ${conversation.topic || 'General support'}. Here are the last messages:\n\n${messagesContext}\n\nGenerate 3 things the seeker might want to say or ask about their topic.`;
    }

    // Call Claude API
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: mode === 'coaching' ? 150 : 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock?.text || '';

    // Parse JSON response
    try {
      if (mode === 'coaching') {
        const parsed = JSON.parse(responseText) as { tip: string };
        if (typeof parsed.tip !== 'string') {
          throw new Error('Invalid response structure');
        }
        res.json({ tip: parsed.tip });
      } else {
        const parsed = JSON.parse(responseText) as { suggestions: string[] };
        if (!Array.isArray(parsed.suggestions)) {
          throw new Error('Invalid response structure');
        }
        res.json({ suggestions: parsed.suggestions.slice(0, 3) });
      }
    } catch {
      console.error('Failed to parse suggestions response:', responseText);
      if (mode === 'coaching') {
        res.json({ tip: 'Listen actively and validate their feelings before offering suggestions.' });
      } else {
        res.json({
          suggestions: mode === 'helper'
            ? [
                "It sounds like you're going through a lot right now. I'm here to listen.",
                "Thank you for sharing that with me. How are you feeling about it?",
                "That makes a lot of sense. Can you tell me more about what that's been like for you?",
              ]
            : [
                "I've been thinking about this a lot lately and I'm not sure where to start.",
                "It would help to hear how others have handled something like this.",
                "I'm feeling a bit overwhelmed and could use some support.",
              ],
        });
      }
    }
  } catch (error) {
    console.error('Suggestions generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function buildCoachingSystemPrompt(): string {
  return `You are a peer support coach for Peerzle. You are NOT in the conversation — you are coaching the helper (peer supporter) on how to respond to what the seeker just said.

Return a single coaching tip in JSON format: {"tip": "your tip here"}

Guidelines:
- One tip only, 1-2 sentences max
- Focus on the approach, not specific words — tell them WHAT to do, not what to say
- Reference what the seeker just expressed and suggest how to engage with it
- Examples of good tips:
  - "They're expressing feeling overwhelmed. Start by naming what you're hearing before asking questions."
  - "They just shared something vulnerable. Acknowledge the courage it took to say that before moving on."
  - "They seem to be looking for validation, not solutions. Reflect back what they said in your own words."
  - "Their energy just shifted — they went from frustrated to sad. Match that shift in your response."
- If the helper's last message was tone-deaf or too upbeat for the context, gently flag it:
  - "Your last response was encouraging, but they may need you to sit with the difficulty first."
- Never be critical of the helper — always frame as "consider" or "try"
- If there's crisis language, tip should reference guiding toward resources

Respond ONLY with valid JSON (no markdown, no code blocks):
{"tip": "your coaching tip here"}`;
}

function buildHelperSystemPrompt(): string {
  return `You are a peer support conversation facilitator for Peerzle, a platform where trained volunteer helpers support seekers through text-based conversations.

Your job is to generate 3 suggested responses that the helper could send to the seeker. Each suggestion should:
- Be empathetic, warm, and non-directive
- Be 1-2 sentences long
- Use validating language that reflects the seeker's feelings
- Avoid giving advice or trying to fix problems
- Never diagnose or recommend treatments
- Vary in approach: one could reflect feelings, one could ask an open-ended question, one could validate and normalize

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}`;
}

function buildSeekerSystemPrompt(): string {
  return `You are a gentle conversation facilitator for Peerzle, a peer support platform.

Generate 3 things the seeker might want to say or ask about their topic.
Keep them gentle and easy to use as conversation starters or continuers.
Each should be 1-2 sentences. Vary between sharing feelings, asking for perspective, and expressing a need.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}`;
}

export default router;
