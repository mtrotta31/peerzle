/**
 * Mock data for Admin Mood Trends Dashboard
 * This will be replaced with real API calls when the backend is ready
 */

import {
  MoodTrendsResponse,
  MoodTrendsDailyAverage,
  MoodAlert,
  MoodAlertsResponse,
} from './api';

// Generate realistic daily averages for a given number of days
function generateDailyAverages(days: number): MoodTrendsDailyAverage[] {
  const averages: MoodTrendsDailyAverage[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Create realistic variance: base around 3.2-3.6 with some noise
    // Add slight weekly pattern (lower on Mondays, higher on Fridays)
    const dayOfWeek = date.getDay();
    const weekdayModifier = dayOfWeek === 1 ? -0.2 : dayOfWeek === 5 ? 0.2 : 0;

    // Add some random noise
    const noise = (Math.random() - 0.5) * 0.6;

    // Add a slight trend (improving over time)
    const trendModifier = (days - i) * 0.005;

    const avgMood = Math.max(1, Math.min(5, 3.3 + weekdayModifier + noise + trendModifier));

    // Check-in count varies by day
    const baseCount = 45;
    const countNoise = Math.floor((Math.random() - 0.3) * 20);
    const checkinCount = Math.max(10, baseCount + countNoise);

    averages.push({
      date: date.toISOString().split('T')[0],
      avg_mood: Math.round(avgMood * 100) / 100,
      checkin_count: checkinCount,
    });
  }

  return averages;
}

// Generate mock data based on period
export function getMockMoodTrends(period: '7d' | '30d' | '90d', _organizationId?: string): MoodTrendsResponse {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const dailyAverages = generateDailyAverages(days);

  // Calculate summary from daily data
  const currentPeriodAvg = dailyAverages.slice(-Math.floor(days / 2))
    .reduce((sum, d) => sum + d.avg_mood, 0) / Math.floor(days / 2);

  const previousPeriodAvg = dailyAverages.slice(0, Math.floor(days / 2))
    .reduce((sum, d) => sum + d.avg_mood, 0) / Math.floor(days / 2);

  const totalCheckins = dailyAverages.reduce((sum, d) => sum + d.checkin_count, 0);

  // Determine trend
  const diff = currentPeriodAvg - previousPeriodAvg;
  const trend: 'improving' | 'declining' | 'stable' =
    diff > 0.15 ? 'improving' : diff < -0.15 ? 'declining' : 'stable';

  return {
    summary: {
      avg_mood_current: Math.round(currentPeriodAvg * 100) / 100,
      avg_mood_previous: Math.round(previousPeriodAvg * 100) / 100,
      trend,
      total_checkins: totalCheckins,
      participation_rate: 0.72,
      critical_alerts: 2,
    },
    daily_averages: dailyAverages,
    distribution: {
      much_worse: 0.05,
      slightly_down: 0.18,
      neutral: 0.35,
      okay: 0.28,
      good: 0.14,
    },
    topic_correlation: [
      { topic: 'Burnout', avg_mood: 2.1, volume: 34 },
      { topic: 'Work-Life Balance', avg_mood: 2.8, volume: 22 },
      { topic: 'Anxiety', avg_mood: 2.9, volume: 28 },
      { topic: 'Family Stress', avg_mood: 3.1, volume: 18 },
      { topic: 'Workplace Conflict', avg_mood: 3.2, volume: 15 },
      { topic: 'General Support', avg_mood: 3.8, volume: 42 },
    ],
  };
}

// Generate mock alerts
export function getMockMoodAlerts(_organizationId?: string): MoodAlertsResponse {
  const mockAlerts: MoodAlert[] = [
    {
      display_name: 'QuietHawk42',
      pattern: 'consecutive_low',
      pattern_description: '3 consecutive "Much Worse" check-ins',
      last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    },
    {
      display_name: 'SteadyOak17',
      pattern: 'significant_decline',
      pattern_description: 'Mood declined 1.8 points over past 7 days',
      last_seen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
    {
      display_name: 'CalmRiver88',
      pattern: 'disengaged',
      pattern_description: 'No check-in for 9 days after being active',
      last_seen: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days ago
    },
  ];

  return {
    alerts: mockAlerts,
    not_enough_data: false,
  };
}

// Function to get mock data with simulated loading
// Returns a promise to mimic API behavior
export async function getMockMoodTrendsAsync(
  period: '7d' | '30d' | '90d',
  organizationId?: string
): Promise<MoodTrendsResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getMockMoodTrends(period, organizationId);
}

export async function getMockMoodAlertsAsync(
  organizationId?: string
): Promise<MoodAlertsResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));
  return getMockMoodAlerts(organizationId);
}
