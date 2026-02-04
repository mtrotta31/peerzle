// Community-specific topic lists for onboarding
// These topics are used for experience selection and matching

const FIRST_RESPONDERS_TOPICS = [
  'PTSD & Trauma',
  'Work-Life Balance',
  'Burnout',
  'Grief & Loss',
  'Sleep Issues',
  'Relationship Stress',
  'Substance Use',
  'Anxiety',
  'Depression',
  'Peer Pressure at Work',
  'Financial Stress',
  'Family Strain',
];

const DEFAULT_TOPICS = [
  'Academic Pressure',
  'Belonging & Community',
  'Burnout',
  'Family Pressure',
  'Financial Stress',
  'General Anxiety',
  'Health Stress',
  'Homesickness',
  'Loneliness',
  'Relationship Stress',
  'Social Anxiety',
];

// Map of community slugs to their specific topics
const COMMUNITY_TOPICS: Record<string, string[]> = {
  'first-responders': FIRST_RESPONDERS_TOPICS,
};

export function getTopicsForCommunity(communitySlug: string): string[] {
  return COMMUNITY_TOPICS[communitySlug] || DEFAULT_TOPICS;
}

export { DEFAULT_TOPICS, FIRST_RESPONDERS_TOPICS };
