// Anonymous display name generator for peer support conversations

const ADJECTIVES = [
  'Brave',
  'Calm',
  'Gentle',
  'Kind',
  'Steady',
  'Warm',
  'Bold',
  'Bright',
  'Deep',
  'Free',
  'Open',
  'Quiet',
  'Strong',
  'True',
  'Wise',
];

const NOUNS = [
  'Eagle',
  'River',
  'Storm',
  'Mountain',
  'Forest',
  'Ocean',
  'Falcon',
  'Cedar',
  'Horizon',
  'Meadow',
  'Phoenix',
  'Stone',
  'Willow',
  'Harbor',
  'Summit',
];

export function generateDisplayName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 90) + 10; // 10-99

  return `${adjective}${noun}${number}`;
}

export { ADJECTIVES, NOUNS };
