/**
 * Crisis Resources Configuration
 *
 * Defines crisis hotline resources for different communities.
 * Used by PeerBot to send warm, supportive messages when concerning content is detected.
 */

export interface CrisisResource {
  name: string;
  action: string;
  description?: string;
}

export interface CrisisResources {
  primary: CrisisResource;
  secondary: CrisisResource[];
}

export const DEFAULT_CRISIS_RESOURCES: CrisisResources = {
  primary: {
    name: '988 Suicide & Crisis Lifeline',
    action: 'Call or text 988',
    description: 'Free, confidential support 24/7',
  },
  secondary: [
    { name: 'Crisis Text Line', action: 'Text HOME to 741741' },
    { name: 'Emergency', action: 'Call 911' },
  ],
};

export const VETERANS_CRISIS_RESOURCES: CrisisResources = {
  primary: {
    name: 'Veterans Crisis Line',
    action: 'Call 988, Press 1',
    description: 'Free, confidential support for Veterans 24/7',
  },
  secondary: [
    { name: 'Veterans Crisis Chat', action: 'veteranscrisisline.net/chat' },
    { name: 'Emergency', action: 'Call 911' },
  ],
};

/**
 * Get crisis resources for a specific community.
 * Returns community-specific resources if available, otherwise default 988 resources.
 */
export function getCrisisResources(communitySlug: string): CrisisResources {
  if (communitySlug === 'veterans') {
    return VETERANS_CRISIS_RESOURCES;
  }

  return DEFAULT_CRISIS_RESOURCES;
}

/**
 * Format crisis resources into a warm, human-feeling message.
 * Returns plain text (no markdown) since ChatPage uses pre-wrap without markdown rendering.
 */
export function formatCrisisMessage(resources: CrisisResources): string {
  const lines: string[] = [
    "Hey, it sounds like you're going through something really heavy right now.",
    "I want you to know that you're not alone, and there are people who can help.",
    '',
    `${resources.primary.name} - ${resources.primary.action}`,
  ];

  if (resources.primary.description) {
    lines.push(resources.primary.description);
  }

  lines.push('');

  for (const resource of resources.secondary) {
    lines.push(`${resource.name} - ${resource.action}`);
  }

  lines.push('');
  lines.push(
    "I'm here to listen, and so are these professionals. Whatever you're feeling right now, it matters, and you deserve support."
  );

  return lines.join('\n');
}
