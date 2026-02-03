// Helper Training Module Content
// 3 modules that helpers must complete before becoming available

export interface TrainingQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrainingModule {
  moduleNumber: number;
  title: string;
  description: string;
  lessonContent: string;
  questions: TrainingQuestion[];
}

export const PASSING_SCORE = 75; // Need 75% (3 of 4) to pass

export const trainingModules: TrainingModule[] = [
  {
    moduleNumber: 1,
    title: 'How Peerzle Works',
    description: 'Learn the basics of providing peer support on Peerzle',
    lessonContent: `
## Welcome to Peerzle

As a helper on Peerzle, you'll be connecting with people who need someone to talk to. Here's what you need to know:

### How Conversations Work

**You'll receive chat requests** from people seeking support. When you mark yourself as "Available to Help," you'll see pending requests that you can choose to accept.

**All conversations are anonymous.** You won't know who you're talking to, and they won't know who you are. This creates a safe space for honest, judgment-free conversations.

### Your Availability

**You're never obligated to accept every request.** It's important that you only help when you're in the right headspace to do so. However, when you do mark yourself as available, please respond promptly to requests.

**You can end conversations at any time.** If a conversation becomes overwhelming or uncomfortable for you, it's OK to step away.

### Tools Available to You

**AI-Suggested Responses:** Our in-conversation facilitator provides suggested responses and tips to help you support the seeker effectively.

**Automatic Safety Monitoring:** Our AI system monitors conversations for crisis indicators and automatically displays emergency resources (988 Lifeline, Crisis Text Line, 911) when needed.

### Key Points to Remember

- You're a peer supporter, not a therapist
- Anonymous conversations create safe spaces
- Accept requests only when you're ready
- Use the AI tools to help you respond effectively
- Your wellbeing matters too
    `.trim(),
    questions: [
      {
        id: 1,
        question: 'Are you required to accept every help request you receive?',
        options: [
          'Yes - you must accept all requests when available',
          'No - you\'re encouraged to help but never obligated',
          'Only if it\'s your first request of the day',
          'Only during business hours'
        ],
        correctIndex: 1,
        explanation: 'You\'re encouraged to help but never obligated. Only accept requests when you\'re in the right headspace to provide support.'
      },
      {
        id: 2,
        question: 'What tools are available to you during conversations?',
        options: [
          'Only a text chat interface',
          'Video calling and screen sharing',
          'AI-suggested responses and facilitator tips',
          'Access to the seeker\'s profile information'
        ],
        correctIndex: 2,
        explanation: 'The in-conversation facilitator provides AI-suggested responses and helpful tips to guide your conversations.'
      },
      {
        id: 3,
        question: 'Can you see the seeker\'s real name or identity?',
        options: [
          'Yes - full profile is visible',
          'Only their first name',
          'Only after the conversation ends',
          'No - all conversations are anonymous'
        ],
        correctIndex: 3,
        explanation: 'All conversations on Peerzle are anonymous to create a safe, judgment-free environment.'
      },
      {
        id: 4,
        question: 'What happens if the system detects someone may be in crisis?',
        options: [
          'The conversation is immediately ended',
          'Emergency resources are automatically displayed',
          'You must call 911 yourself',
          'Nothing - you handle it on your own'
        ],
        correctIndex: 1,
        explanation: 'When crisis indicators are detected, emergency resources (988 Lifeline, Crisis Text Line, 911) are automatically displayed to both participants.'
      }
    ]
  },
  {
    moduleNumber: 2,
    title: 'How to Respond',
    description: 'Learn effective peer support techniques and what to avoid',
    lessonContent: `
## Effective Peer Support

Being a good listener is more about what you *don't* do than what you do. Here are the key principles:

### Avoid Toxic Positivity

**Don't be a "positivity pusher."** Phrases like "Stay positive!" or "Look on the bright side!" can actually make people feel worse. They send the message that negative feelings aren't acceptable.

**Let people feel their feelings.** When someone is struggling, they need to express themselves - to complain, vent, and be heard. This is healthy and necessary.

### The Power of Validation

**"Negative" thoughts have value.** Complaining helps people identify what's wrong and what needs to change. Don't rush to fix or reframe.

Use validating phrases:
- "That sounds really hard."
- "That makes sense."
- "What's been the hardest part for you?"
- "I hear you."

### Finding Balance

**Validate feelings while maintaining hope.** You can acknowledge pain without agreeing that everything is hopeless. The goal is to help someone feel heard first, then potentially explore possibilities.

**It's OK to not know what to say.** Sometimes the best response is: "I'm not sure what to say, but I'm here to listen." Silence and presence can be powerful.

### Remember Your Role

**You're a peer, not a therapist.** Your shared experience as a human being is your strength. You're not here to diagnose, treat, or fix - you're here to connect and listen.

### Key Techniques

- Ask open-ended questions: "What's going on?" instead of "Are you OK?"
- Reflect back what you hear: "It sounds like you're feeling..."
- Avoid giving unsolicited advice
- Don't compare their experience to yours or others'
    `.trim(),
    questions: [
      {
        id: 1,
        question: 'A seeker says "Nothing ever goes right for me." What\'s the best response?',
        options: [
          '"Stay positive! Things will get better!"',
          '"That sounds really frustrating. What\'s been going on?"',
          '"Have you tried thinking more positively?"',
          '"Everyone feels that way sometimes, you\'ll be fine."'
        ],
        correctIndex: 1,
        explanation: 'Validating their feelings and asking an open-ended question invites them to share more, rather than shutting down their emotions.'
      },
      {
        id: 2,
        question: 'What does "toxic positivity" mean?',
        options: [
          'Being too happy all the time',
          'Forcing positive statements that suppress real emotions',
          'Avoiding all negative topics',
          'Using too many emojis'
        ],
        correctIndex: 1,
        explanation: 'Toxic positivity means pushing positive messages in a way that dismisses or suppresses genuine negative emotions that need to be expressed.'
      },
      {
        id: 3,
        question: 'You don\'t know what to say to a seeker. What should you do?',
        options: [
          'End the conversation immediately',
          'Change the subject to something lighter',
          'It\'s OK to say "I\'m not sure what to say, but I\'m here to listen"',
          'Give them advice about what to do'
        ],
        correctIndex: 2,
        explanation: 'Admitting uncertainty while affirming your presence is honest and supportive. You don\'t need to have all the answers.'
      },
      {
        id: 4,
        question: 'What is your primary role as a helper?',
        options: [
          'Being a therapist who can diagnose issues',
          'Giving advice to solve their problems',
          'Being a supportive peer who listens',
          'Teaching them coping strategies'
        ],
        correctIndex: 2,
        explanation: 'Your role is to be a supportive peer who listens. You\'re not a therapist - your shared humanity is your strength.'
      }
    ]
  },
  {
    moduleNumber: 3,
    title: 'Recognizing & Responding to Crisis',
    description: 'Learn how to identify crisis situations and take appropriate action',
    lessonContent: `
## Crisis Recognition & Response

Some conversations may involve people who are in crisis. Here's how to handle these situations:

### Automatic Crisis Detection

**Our AI monitors conversations** for crisis indicators and automatically displays emergency resources when needed. These include:
- **988 Suicide & Crisis Lifeline** - Call or text 988
- **Crisis Text Line** - Text HOME to 741741
- **Emergency Services** - Call 911

### The System Isn't Perfect

**You may notice signs the AI misses.** Be alert for:
- Mentions of self-harm or suicide
- Expressions of hopelessness ("What's the point?")
- Feeling like a burden to others
- Saying goodbye or giving away possessions
- Sudden calm after a period of depression

### What To Do If You Suspect Crisis

**Report immediately.** If you believe someone is in crisis but the system hasn't flagged it, use the report feature right away. Don't try to handle a crisis on your own.

**Never attempt to be the sole support** for someone in crisis. Professional crisis counselors are trained for these situations. Your job is to connect them with appropriate resources.

### Your Wellbeing Matters

**It's OK to end a conversation** that becomes overwhelming for you. Supporting others is important, but not at the expense of your own mental health.

**Debrief if needed.** After a difficult conversation, take time to process. Reach out to your own support system if you need to talk.

### Key Principles

- Trust your instincts - if something feels wrong, report it
- Don't try to be a hero - professional help exists for a reason
- Emergency resources are always visible when crisis is detected
- Your safety and wellbeing are just as important as the seeker's
    `.trim(),
    questions: [
      {
        id: 1,
        question: 'What should you do if you think someone is in crisis but the system hasn\'t flagged it?',
        options: [
          'Wait to see if it gets worse',
          'Try to talk them out of it yourself',
          'Report immediately using the report feature',
          'End the conversation and hope they\'re OK'
        ],
        correctIndex: 2,
        explanation: 'Always report immediately if you suspect crisis. Don\'t try to handle it alone - professional help needs to be connected.'
      },
      {
        id: 2,
        question: 'What resources appear when crisis is detected?',
        options: [
          'A list of local therapists',
          '988 Suicide & Crisis Lifeline, Crisis Text Line, 911',
          'An automatic email to the seeker\'s emergency contact',
          'A meditation app recommendation'
        ],
        correctIndex: 1,
        explanation: 'Emergency resources including 988 Lifeline, Crisis Text Line, and 911 are automatically displayed when crisis is detected.'
      },
      {
        id: 3,
        question: 'A seeker says they "don\'t see the point anymore." What do you do?',
        options: [
          'Tell them to think about all the good things in their life',
          'Share a time when you felt the same way',
          'Report the conversation - don\'t try to handle crisis alone',
          'Ask them to explain what they mean'
        ],
        correctIndex: 2,
        explanation: 'This statement suggests potential crisis. Report immediately to ensure professional resources can be connected.'
      },
      {
        id: 4,
        question: 'Is it OK to end a conversation that\'s making you feel overwhelmed?',
        options: [
          'No - you must always prioritize the seeker',
          'Only if it\'s been longer than 30 minutes',
          'Yes - your wellbeing matters too',
          'Only if another helper is available'
        ],
        correctIndex: 2,
        explanation: 'Your mental health matters. It\'s OK to step away from a conversation that becomes overwhelming for you.'
      }
    ]
  }
];

export function getModule(moduleNumber: number): TrainingModule | undefined {
  return trainingModules.find(m => m.moduleNumber === moduleNumber);
}

export function calculateScore(moduleNumber: number, answers: number[]): number {
  const module = getModule(moduleNumber);
  if (!module) return 0;

  const correct = answers.filter((answer, index) =>
    module.questions[index]?.correctIndex === answer
  ).length;

  return Math.round((correct / module.questions.length) * 100);
}
