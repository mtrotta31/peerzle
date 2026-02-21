import Anthropic from '@anthropic-ai/sdk';

// Lazy initialization to ensure env vars are loaded
let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log('PeerBot: Initializing Anthropic client, API key present:', !!apiKey);
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set in environment variables');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

interface Message {
  content: string;
  sender_email: string | null;
  is_peerbot?: boolean;
}

interface ConversationContext {
  topic: string | null;
  community_name: string;
}

interface PeerBotOptions {
  isDemo?: boolean;
}

function buildDemoHelperPrompt(context: ConversationContext): string {
  return `You are a trained peer supporter on Peerzle, a peer-to-peer support platform.
You are chatting with someone who selected the topic: ${context.topic || 'General Support'}.

Your role:
- Act as a warm, empathetic peer helper having a genuine conversation
- You are NOT an AI assistant — you are demonstrating what a real peer conversation feels like
- Use active listening, reflect feelings, ask open-ended questions
- Share brief, relatable experiences when appropriate (keep them generic and believable)
- Use the coaching tips naturally: validate feelings before offering solutions, ask before advising
- Keep responses conversational length (2-4 sentences typical, occasionally longer)
- If they seem to be testing the platform rather than sharing real concerns, gently play along and show the depth of conversation possible

Do NOT:
- Say you are an AI or a bot
- Say you are a demo
- Provide clinical advice or diagnoses
- Break character as a peer supporter

Community: ${context.community_name}
Topic: ${context.topic || 'General Support'}

Start by warmly greeting them and asking what's been on their mind.`;
}

function buildSystemPrompt(context: ConversationContext): string {
  const communityContext = context.community_name.toLowerCase().includes('first responder')
    ? `
You understand the unique stresses and challenges that first responders face:
- High-stress situations and trauma exposure
- Shift work and irregular schedules
- The pressure to always be strong
- Difficulty talking about struggles with colleagues
- The weight of life-and-death decisions`
    : '';

  return `You are PeerBot, a warm and supportive AI peer support companion for the ${context.community_name} community.

Your role:
- Provide empathetic, non-judgmental support while users wait for a human peer supporter
- Listen actively and validate feelings
- Ask open-ended questions to encourage sharing
- Keep responses concise (2-3 sentences usually)
- Be warm, genuine, and caring

${communityContext}

Important guidelines:
- NEVER provide medical, legal, or professional advice
- NEVER diagnose conditions or recommend treatments
- If someone expresses thoughts of self-harm or suicide, acknowledge their pain and encourage them to reach out to emergency services or a crisis hotline
- You're here to listen and support, not to solve problems
- Let the user know you're an AI companion helping while they wait for a human peer supporter
- Focus on emotional support and understanding

${context.topic ? `The user wants to discuss: ${context.topic}` : ''}

Remember: You're a supportive presence, not a therapist or counselor.`;
}

export async function generatePeerBotResponse(
  messages: Message[],
  context: ConversationContext,
  options?: PeerBotOptions
): Promise<string> {
  // Convert messages to Claude format
  const conversationMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
    role: msg.is_peerbot ? 'assistant' : 'user',
    content: msg.content,
  }));

  // If this is the first message (no previous PeerBot responses), add a greeting
  const hasPeerBotMessage = messages.some((m) => m.is_peerbot);

  if (!hasPeerBotMessage && conversationMessages.length === 1) {
    // First message from user, PeerBot should greet and acknowledge
  }

  // Use demo helper prompt for demo conversations, otherwise use standard prompt
  const systemPrompt = options?.isDemo
    ? buildDemoHelperPrompt(context)
    : buildSystemPrompt(context);

  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.text || "I'm here to listen. Please share what's on your mind.";
  } catch (error) {
    console.error('PeerBot API error:', error);
    // Fallback response if API fails
    return "I'm here with you. Take your time to share what's on your mind.";
  }
}
