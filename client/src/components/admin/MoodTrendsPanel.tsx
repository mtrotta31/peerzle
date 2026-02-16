import { useState, useEffect } from 'react';
import {
  MoodTrendsResponse,
  MoodAlert,
} from '../../services/api';
import {
  getMockMoodTrendsAsync,
  getMockMoodAlertsAsync,
} from '../../services/mockMoodTrendsData';

// Color mapping for mood scores (matches MoodHistoryPage)
const MOOD_COLORS: Record<number, string> = {
  1: '#DC2626', // Much Worse - red
  2: '#F59E0B', // Slightly Down - amber
  3: '#94A3B8', // Neutral - gray
  4: '#22C55E', // Okay - light green
  5: '#16A34A', // Good - green
};

// Mood labels for distribution
const MOOD_LABELS: Record<string, { label: string; color: string; value: number }> = {
  much_worse: { label: 'Much Worse', color: '#DC2626', value: 1 },
  slightly_down: { label: 'Slightly Down', color: '#F59E0B', value: 2 },
  neutral: { label: 'Neutral', color: '#94A3B8', value: 3 },
  okay: { label: 'Okay', color: '#22C55E', value: 4 },
  good: { label: 'Good', color: '#16A34A', value: 5 },
};

// Get emoji for mood value
const getMoodEmoji = (mood: number): string => {
  if (mood <= 1.5) return '\u{1F62B}'; // 😫
  if (mood <= 2.5) return '\u{1F61F}'; // 😟
  if (mood <= 3.5) return '\u{1F610}'; // 😐
  if (mood <= 4.5) return '\u{1F642}'; // 🙂
  return '\u{1F60A}'; // 😊
};

interface MoodTrendsPanelProps {
  selectedOrgId: string | null;
}

export default function MoodTrendsPanel({ selectedOrgId }: MoodTrendsPanelProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [trends, setTrends] = useState<MoodTrendsResponse | null>(null);
  const [alerts, setAlerts] = useState<MoodAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notEnoughData, setNotEnoughData] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // TODO: Replace with real API calls when backend is ready
        // const [trendsData, alertsData] = await Promise.all([
        //   getAdminMoodTrends(communitySlug, period, selectedOrgId || undefined),
        //   getAdminMoodAlerts(communitySlug, selectedOrgId || undefined),
        // ]);

        const [trendsData, alertsData] = await Promise.all([
          getMockMoodTrendsAsync(period, selectedOrgId || undefined),
          getMockMoodAlertsAsync(selectedOrgId || undefined),
        ]);

        setTrends(trendsData);
        setAlerts(alertsData.alerts);
        setNotEnoughData(alertsData.not_enough_data);
      } catch (err) {
        console.error('Failed to load mood trends:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [period, selectedOrgId]);

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#64748B', margin: 0 }}>Loading mood trends...</p>
      </div>
    );
  }

  if (notEnoughData || !trends) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{'\u{1F4CA}'}</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
          Not Enough Data for Trends
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          Mood analytics require at least 5 active members with check-ins. As more members engage, you&apos;ll see trends here.
        </p>
      </div>
    );
  }

  const { summary, daily_averages, distribution, topic_correlation } = trends;

  // Calculate percentage change
  const percentChange = summary.avg_mood_previous > 0
    ? ((summary.avg_mood_current - summary.avg_mood_previous) / summary.avg_mood_previous) * 100
    : 0;

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        marginBottom: '24px',
      }}
    >
      {/* Header with Period Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
          Wellness Trends
        </h2>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Wellness Pulse Card */}
      <WellnessPulseCard
        currentMood={summary.avg_mood_current}
        previousMood={summary.avg_mood_previous}
        trend={summary.trend}
        percentChange={percentChange}
      />

      {/* Mood Trend Chart */}
      <div style={{ marginTop: '24px' }}>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Mood Over Time
        </p>
        <MoodTrendChart data={daily_averages} period={period} />
      </div>

      {/* Stats Grid: Participation Rate + Mood Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginTop: '24px',
        }}
      >
        <ParticipationRate
          rate={summary.participation_rate}
          totalCheckins={summary.total_checkins}
        />
        <MoodDistribution distribution={distribution} />
      </div>

      {/* Topic Correlation */}
      {topic_correlation.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <TopicCorrelation topics={topic_correlation} />
        </div>
      )}

      {/* Attention Needed */}
      {alerts.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <AttentionNeededList alerts={alerts} />
        </div>
      )}
    </div>
  );
}

// Period Selector Component
function PeriodSelector({
  period,
  onChange,
}: {
  period: '7d' | '30d' | '90d';
  onChange: (p: '7d' | '30d' | '90d') => void;
}) {
  const options: Array<'7d' | '30d' | '90d'> = ['7d', '30d', '90d'];
  const labels = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' };

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: '#F1F5F9',
        borderRadius: '10px',
        padding: '4px',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: period === opt ? 'white' : 'transparent',
            color: period === opt ? '#1E3A5F' : '#64748B',
            boxShadow: period === opt ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

// Wellness Pulse Card Component
function WellnessPulseCard({
  currentMood,
  previousMood,
  trend,
  percentChange,
}: {
  currentMood: number;
  previousMood: number;
  trend: 'improving' | 'declining' | 'stable';
  percentChange: number;
}) {
  const trendConfig = {
    improving: { arrow: '\u2191', color: '#16A34A', bg: '#F0FDF4', label: 'Improving' },
    declining: { arrow: '\u2193', color: '#DC2626', bg: '#FEF2F2', label: 'Declining' },
    stable: { arrow: '\u2192', color: '#64748B', bg: '#F8FAFC', label: 'Stable' },
  };

  const { arrow, color, bg, label } = trendConfig[trend];

  return (
    <div
      style={{
        backgroundColor: bg,
        borderRadius: '12px',
        padding: '20px 24px',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Wellness Pulse
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '36px', fontWeight: 700, color: '#1E3A5F' }}>
              {currentMood.toFixed(1)}
            </span>
            <span style={{ fontSize: '18px', color: '#94A3B8' }}>/ 5.0</span>
            <span style={{ fontSize: '28px' }}>{getMoodEmoji(currentMood)}</span>
            <span style={{ fontSize: '24px', color, fontWeight: 600 }}>{arrow}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 12px',
              backgroundColor: color,
              color: 'white',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748B' }}>
            vs {previousMood.toFixed(1)} last period
            {percentChange !== 0 && (
              <span style={{ color, fontWeight: 500 }}>
                {' '}({percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// Mood Trend Chart Component (Custom SVG)
function MoodTrendChart({
  data,
  period,
}: {
  data: { date: string; avg_mood: number; checkin_count: number }[];
  period: '7d' | '30d' | '90d';
}) {
  const width = 100; // percentage-based viewBox
  const height = 40;
  const padding = { top: 5, right: 5, bottom: 8, left: 8 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale functions
  const xScale = (index: number) =>
    padding.left + (index / (data.length - 1)) * chartWidth;

  const yScale = (value: number) =>
    padding.top + chartHeight - ((value - 1) / 4) * chartHeight;

  // Generate line path
  const linePath = data
    .map((d, i) => {
      const x = xScale(i);
      const y = yScale(d.avg_mood);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate area path (for gradient fill under line)
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(1)} L ${xScale(0)} ${yScale(1)} Z`;

  // X-axis labels - show fewer for longer periods
  const labelInterval = period === '7d' ? 1 : period === '30d' ? 7 : 14;

  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '180px' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2B7CF6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2B7CF6" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[1, 2, 3, 4, 5].map((val) => (
          <g key={val}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(val)}
              y2={yScale(val)}
              stroke="#E2E8F0"
              strokeWidth="0.3"
              strokeDasharray="1,1"
            />
            <text
              x={padding.left - 1}
              y={yScale(val)}
              fontSize="2.5"
              fill="#94A3B8"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {val}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#2B7CF6"
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.avg_mood)}
            r="0.8"
            fill="white"
            stroke="#2B7CF6"
            strokeWidth="0.4"
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelInterval !== 0 && i !== data.length - 1) return null;
          const date = new Date(d.date);
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <text
              key={i}
              x={xScale(i)}
              y={height - 1}
              fontSize="2.2"
              fill="#94A3B8"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Participation Rate Component
function ParticipationRate({
  rate,
  totalCheckins,
}: {
  rate: number;
  totalCheckins: number;
}) {
  const percentage = Math.round(rate * 100);

  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Participation Rate
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px', fontWeight: 700, color: '#1E3A5F' }}>
          {percentage}%
        </span>
        <span style={{ fontSize: '14px', color: '#64748B' }}>
          of members checked in
        </span>
      </div>
      {/* Progress bar */}
      <div
        style={{
          marginTop: '12px',
          height: '8px',
          backgroundColor: '#E2E8F0',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: '#2B7CF6',
            borderRadius: '4px',
            transition: 'width 0.3s',
          }}
        />
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94A3B8' }}>
        {totalCheckins.toLocaleString()} total check-ins this period
      </p>
    </div>
  );
}

// Mood Distribution Component
function MoodDistribution({
  distribution,
}: {
  distribution: {
    much_worse: number;
    slightly_down: number;
    neutral: number;
    okay: number;
    good: number;
  };
}) {
  const entries = Object.entries(distribution) as Array<[keyof typeof distribution, number]>;
  const total = entries.reduce((sum, [, val]) => sum + val, 0);

  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Mood Distribution
      </p>

      {/* Stacked horizontal bar */}
      <div
        style={{
          display: 'flex',
          height: '24px',
          borderRadius: '6px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: MOOD_LABELS[key].color,
              minWidth: value > 0 ? '4px' : '0',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 16px',
        }}
      >
        {entries.map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                backgroundColor: MOOD_LABELS[key].color,
              }}
            />
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {MOOD_LABELS[key].label}: {Math.round(value * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Topic Correlation Component
function TopicCorrelation({
  topics,
}: {
  topics: { topic: string; avg_mood: number; volume: number }[];
}) {
  // Sort by avg_mood ascending (lowest first - these need attention)
  const sortedTopics = [...topics].sort((a, b) => a.avg_mood - b.avg_mood);
  const maxVolume = Math.max(...topics.map((t) => t.volume));

  return (
    <div
      style={{
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <p
        style={{
          margin: '0 0 4px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Topics by Avg Mood
      </p>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: '12px',
          color: '#94A3B8',
        }}
      >
        Topics with lower mood scores may need attention
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sortedTopics.slice(0, 6).map((topic) => {
          const moodColor = MOOD_COLORS[Math.round(topic.avg_mood)] || '#94A3B8';
          const needsAttention = topic.avg_mood < 3.0;

          return (
            <div
              key={topic.topic}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ flex: '0 0 140px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {needsAttention && (
                  <span style={{ color: '#F59E0B', fontSize: '14px' }}>{'\u26A0'}</span>
                )}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: needsAttention ? '#DC2626' : '#1E3A5F',
                  }}
                >
                  {topic.topic}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: '8px',
                    backgroundColor: '#E2E8F0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(topic.volume / maxVolume) * 100}%`,
                      height: '100%',
                      backgroundColor: moodColor,
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  flex: '0 0 80px',
                  textAlign: 'right',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '18px' }}>{getMoodEmoji(topic.avg_mood)}</span>
                <span style={{ fontSize: '14px', fontWeight: 500, color: moodColor }}>
                  {topic.avg_mood.toFixed(1)}
                </span>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                  ({topic.volume})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Attention Needed List Component
function AttentionNeededList({ alerts }: { alerts: MoodAlert[] }) {
  const patternConfig = {
    consecutive_low: {
      badge: 'Critical Pattern',
      badgeColor: '#DC2626',
      badgeBg: '#FEF2F2',
      borderColor: '#FECACA',
    },
    significant_decline: {
      badge: 'Declining',
      badgeColor: '#F59E0B',
      badgeBg: '#FEF3C7',
      borderColor: '#FDE68A',
    },
    disengaged: {
      badge: 'Disengaged',
      badgeColor: '#64748B',
      badgeBg: '#F1F5F9',
      borderColor: '#E2E8F0',
    },
  };

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <span style={{ fontSize: '18px' }}>{'\u26A0\uFE0F'}</span>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#92400E',
          }}
        >
          Attention Needed ({alerts.length})
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alerts.map((alert, index) => {
          const config = patternConfig[alert.pattern];

          return (
            <div
              key={index}
              style={{
                backgroundColor: 'white',
                border: `1px solid ${config.borderColor}`,
                borderRadius: '10px',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
                    {alert.display_name}
                  </span>
                  <span
                    style={{
                      padding: '3px 8px',
                      backgroundColor: config.badgeBg,
                      color: config.badgeColor,
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {config.badge}
                  </span>
                </div>
                {alert.last_seen && (
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                    Last seen: {formatLastSeen(alert.last_seen)}
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748B' }}>
                {alert.pattern_description}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                This member may benefit from outreach
              </p>
            </div>
          );
        })}
      </div>

      <p
        style={{
          margin: '16px 0 0',
          fontSize: '11px',
          color: '#92400E',
          opacity: 0.8,
        }}
      >
        Note: Only display names are shown. No individual mood scores are exposed.
      </p>
    </div>
  );
}
