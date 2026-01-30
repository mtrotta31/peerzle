import Anthropic from '@anthropic-ai/sdk';

// Lazy initialization to ensure env vars are loaded
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('Safety: ANTHROPIC_API_KEY is not set');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

export type RiskLevel = 'safe' | 'mild_concern' | 'moderate_concern' | 'crisis';

export interface SafetyAnalysisResult {
  riskLevel: RiskLevel;
  flags: string[];
  suggestedAction: string;
}

interface ConversationContext {
  topic: string | null;
  recentMessages?: string[];
}

const SAFETY_SYSTEM_PROMPT = `You are a mental health safety classifier. Analyze the message for crisis indicators.

Classify the risk level:
- "safe": Normal conversation, no concerning content
- "mild_concern": Mentions stress, sadness, frustration, but no crisis indicators
- "moderate_concern": Expresses hopelessness, feeling like a burden, wanting pain to end, passive suicidal thoughts
- "crisis": Explicit suicidal ideation, self-harm plans, mentions of specific methods, immediate danger signals

Respond ONLY with valid JSON in this exact format:
{"riskLevel": "<level>", "flags": ["<flag1>", "<flag2>"], "suggestedAction": "<action>"}

Flags should be specific indicators found (e.g., "mentions self-harm", "expresses hopelessness", "discusses specific plan").
SuggestedAction should be brief guidance (e.g., "continue monitoring", "show crisis resources", "immediate intervention needed").

Be sensitive but not alarmist. First responders and healthcare workers may discuss trauma as part of processing their experiences - this alone is not a crisis.`;

export async function analyzeMessageSafety(
  content: string,
  context: ConversationContext
): Promise<SafetyAnalysisResult> {
  // Skip very short messages
  if (content.trim().length < 10) {
    return { riskLevel: 'safe', flags: [], suggestedAction: 'none' };
  }

  const contextInfo = context.topic ? `Topic: ${context.topic}\n` : '';
  const recentContext = context.recentMessages?.length
    ? `Recent conversation context:\n${context.recentMessages.slice(-3).join('\n')}\n\n`
    : '';

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: SAFETY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${contextInfo}${recentContext}Analyze this message:\n"${content}"`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock?.text || '';

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SafetyAnalysisResult;

      // Validate the response
      const validLevels: RiskLevel[] = ['safe', 'mild_concern', 'moderate_concern', 'crisis'];
      if (!validLevels.includes(parsed.riskLevel)) {
        parsed.riskLevel = 'safe';
      }
      if (!Array.isArray(parsed.flags)) {
        parsed.flags = [];
      }
      if (typeof parsed.suggestedAction !== 'string') {
        parsed.suggestedAction = 'continue monitoring';
      }

      return parsed;
    }

    // Default to safe if parsing fails
    return { riskLevel: 'safe', flags: [], suggestedAction: 'parse error - defaulting to safe' };
  } catch (error) {
    console.error('Safety analysis error:', error);
    // On error, default to safe to avoid false alarms
    return { riskLevel: 'safe', flags: [], suggestedAction: 'analysis error - defaulting to safe' };
  }
}

export function shouldShowCrisisResources(riskLevel: RiskLevel): boolean {
  return riskLevel === 'crisis' || riskLevel === 'moderate_concern';
}

export function mapRiskLevelToSeverity(riskLevel: RiskLevel): 'medium' | 'high' | 'critical' {
  switch (riskLevel) {
    case 'crisis':
      return 'critical';
    case 'moderate_concern':
      return 'high';
    default:
      return 'medium';
  }
}
