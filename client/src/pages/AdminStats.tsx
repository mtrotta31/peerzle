import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Community,
  AdminStats as AdminStatsType,
  getCommunity,
  getAdminStats,
} from '../services/api';

export default function AdminStats() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, statsData] = await Promise.all([
          getCommunity(slug),
          getAdminStats(slug),
        ]);
        setCommunity(communityData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
        setError('Failed to load statistics. You may not have admin access.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getMoodEmoji = (mood: number) => {
    if (mood <= 1.5) return { emoji: '\u{1F61E}', label: 'Struggling' }; // 😞
    if (mood <= 2.5) return { emoji: '\u{1F615}', label: 'Difficult' }; // 😕
    if (mood <= 3.5) return { emoji: '\u{1F610}', label: 'Okay' }; // 😐
    if (mood <= 4.5) return { emoji: '\u{1F642}', label: 'Good' }; // 🙂
    return { emoji: '\u{1F60A}', label: 'Great' }; // 😊
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#64748B' }}>Loading statistics...</p>
      </div>
    );
  }

  if (error || !community || !stats) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to={`/community/${slug}/admin`} style={{ color: '#2B7CF6' }}>
          Back to Admin Dashboard
        </Link>
      </div>
    );
  }

  // Check if this is a new community with no data
  const hasData = stats.usage.totalConversations > 0;

  // Calculate helper availability text
  const helperText = stats.usage.totalHelpers > 0
    ? `${stats.usage.activeHelpers} of ${stats.usage.totalHelpers} available`
    : 'No helpers yet';

  // Calculate severity counts
  const criticalAlerts = stats.safety.alertsBySeverity['critical'] || 0;
  const highAlerts = stats.safety.alertsBySeverity['high'] || 0;
  const mediumAlerts = stats.safety.alertsBySeverity['medium'] || 0;

  // Safety status
  const hasCriticalAlerts = criticalAlerts > 0;
  const hasHighAlerts = highAlerts > 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/peerzle-icon.svg"
              alt="Peerzle"
              style={{ width: '32px', height: '32px' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                Platform Overview
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                {community.name}
                {stats.firstConversationDate && (
                  <span> &middot; Since {formatDate(stats.firstConversationDate)}</span>
                )}
              </p>
            </div>
          </div>
          <Link
            to={`/community/${slug}/admin`}
            style={{
              color: '#64748B',
              textDecoration: 'none',
              padding: '8px 16px',
              backgroundColor: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#2B7CF6';
              e.currentTarget.style.color = '#2B7CF6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.color = '#64748B';
            }}
          >
            Back to Admin
          </Link>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
        {!hasData ? (
          // Empty state
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '60px 40px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {'\u{1F331}'}
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 600, color: '#1E3A5F' }}>
              Your community is just getting started
            </h2>
            <p style={{ margin: 0, fontSize: '16px', color: '#64748B', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              Once members start having conversations, you&apos;ll see detailed statistics about how Peerzle is helping your community.
            </p>
          </div>
        ) : (
          <>
            {/* Section 1: Headline Numbers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <HeadlineCard
                label="Total Conversations"
                value={stats.usage.totalConversations}
                subtitle={`${stats.usage.conversationsThisMonth} this month`}
              />
              <HeadlineCard
                label="Mood Improvement"
                value={stats.outcomes.avgMoodImprovement !== null ? `+${stats.outcomes.avgMoodImprovement.toFixed(1)}` : 'N/A'}
                subtitle="average increase"
                color="#16A34A"
                showUpArrow={stats.outcomes.avgMoodImprovement !== null && stats.outcomes.avgMoodImprovement > 0}
              />
              <HeadlineCard
                label="Felt Heard Rate"
                value={`${stats.outcomes.pctFeltHeard.toFixed(0)}%`}
                subtitle="of users"
                color="#F59E0B"
              />
              <HeadlineCard
                label="Active Helpers"
                value={stats.usage.activeHelpers}
                subtitle={helperText}
              />
            </div>

            {/* Section 2: Outcomes */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                Outcomes
              </h2>

              {/* Main headline stat */}
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #16A34A',
                }}
              >
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#16A34A' }}>
                  {stats.outcomes.pctMoodImproved.toFixed(0)}%
                  <span style={{ fontSize: '16px', fontWeight: 400, color: '#1E3A5F', marginLeft: '12px' }}>
                    of users reported feeling better after their conversation
                  </span>
                </p>
              </div>

              {/* Secondary metrics row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Before/After Mood */}
                {stats.outcomes.avgMoodImprovement !== null && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Average Mood
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '20px' }}>{getMoodEmoji(2.1).emoji}</span>
                        <span style={{ fontSize: '18px', fontWeight: 600, color: '#64748B' }}>Before</span>
                      </div>
                      <span style={{ fontSize: '20px', color: '#16A34A' }}>{'\u2192'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '20px' }}>{getMoodEmoji(2.1 + stats.outcomes.avgMoodImprovement).emoji}</span>
                        <span style={{ fontSize: '18px', fontWeight: 600, color: '#16A34A' }}>After</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Star Rating */}
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Average Rating
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          style={{
                            fontSize: '18px',
                            color: stats.outcomes.avgRating && star <= Math.round(stats.outcomes.avgRating) ? '#F59E0B' : '#E2E8F0',
                          }}
                        >
                          {'\u2605'}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                      {stats.outcomes.avgRating?.toFixed(1) || 'N/A'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      ({stats.outcomes.totalRatedConversations} ratings)
                    </span>
                  </div>
                </div>

                {/* Would Recommend */}
                {stats.outcomes.pctWouldRecommend !== null && (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Would Recommend
                    </p>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#1E3A5F' }}>
                      {stats.outcomes.pctWouldRecommend.toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Usage */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                Usage
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <UsageMetric
                  label="This Week"
                  value={stats.usage.conversationsThisWeek}
                  suffix="conversations"
                />
                <UsageMetric
                  label="This Month"
                  value={stats.usage.conversationsThisMonth}
                  suffix="conversations"
                />
                <UsageMetric
                  label="Avg Duration"
                  value={stats.usage.avgConversationDurationMinutes !== null
                    ? `${Math.round(stats.usage.avgConversationDurationMinutes)}`
                    : 'N/A'}
                  suffix={stats.usage.avgConversationDurationMinutes !== null ? 'minutes' : ''}
                />
                <UsageMetric
                  label="Repeat Users"
                  value={`${stats.engagement.pctRepeatUsers.toFixed(0)}%`}
                  suffix="come back"
                />
              </div>

              {/* Helper vs PeerBot breakdown */}
              <div>
                <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Conversation Types
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', borderRadius: '8px', overflow: 'hidden', height: '24px' }}>
                    {stats.usage.conversationsWithHumanHelper > 0 && (
                      <div
                        style={{
                          width: `${(stats.usage.conversationsWithHumanHelper / (stats.usage.conversationsWithHumanHelper + stats.usage.conversationsPeerbotOnly)) * 100}%`,
                          backgroundColor: '#2B7CF6',
                          minWidth: '40px',
                        }}
                      />
                    )}
                    {stats.usage.conversationsPeerbotOnly > 0 && (
                      <div
                        style={{
                          width: `${(stats.usage.conversationsPeerbotOnly / (stats.usage.conversationsWithHumanHelper + stats.usage.conversationsPeerbotOnly)) * 100}%`,
                          backgroundColor: '#94A3B8',
                          minWidth: '40px',
                        }}
                      />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#2B7CF6' }} />
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      Human Helper ({stats.usage.conversationsWithHumanHelper})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#94A3B8' }} />
                    <span style={{ fontSize: '13px', color: '#64748B' }}>
                      PeerBot Only ({stats.usage.conversationsPeerbotOnly})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Top Topics */}
            {stats.topTopics.length > 0 && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  marginBottom: '24px',
                }}
              >
                <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  Top Topics
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748B' }}>
                  What your community members are seeking support with
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.topTopics.map((topic, index) => {
                    const maxCount = stats.topTopics[0].conversationCount;
                    const percentage = (topic.conversationCount / maxCount) * 100;

                    return (
                      <div key={topic.topic} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B', width: '20px' }}>
                          {index + 1}.
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1E3A5F' }}>
                              {topic.topic}
                            </span>
                            <span style={{ fontSize: '13px', color: '#64748B' }}>
                              {topic.conversationCount} conversations
                            </span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: '100%',
                                backgroundColor: '#2B7CF6',
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 5: Safety */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  Safety & Moderation
                </h2>
                {!hasCriticalAlerts && !hasHighAlerts && stats.safety.alertsThisMonth === 0 && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: '#DCFCE7',
                      color: '#16A34A',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {'\u2713'} All Clear
                  </span>
                )}
                {(hasCriticalAlerts || hasHighAlerts) && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: hasCriticalAlerts ? '#FEF2F2' : '#FEF3C7',
                      color: hasCriticalAlerts ? '#DC2626' : '#92400E',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {hasCriticalAlerts ? `${criticalAlerts} Critical` : `${highAlerts} High Priority`}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <SafetyMetric
                  label="Total Alerts"
                  value={stats.safety.totalAlerts}
                />
                <SafetyMetric
                  label="Alerts This Month"
                  value={stats.safety.alertsThisMonth}
                />
                <SafetyMetric
                  label="User Reports"
                  value={stats.safety.totalReports}
                />
                <SafetyMetric
                  label="Reports This Month"
                  value={stats.safety.reportsThisMonth}
                />
              </div>

              {(criticalAlerts > 0 || highAlerts > 0 || mediumAlerts > 0) && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Alerts by Severity
                  </p>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {criticalAlerts > 0 && (
                      <span style={{ fontSize: '14px', color: '#DC2626', fontWeight: 500 }}>
                        Critical: {criticalAlerts}
                      </span>
                    )}
                    {highAlerts > 0 && (
                      <span style={{ fontSize: '14px', color: '#F59E0B', fontWeight: 500 }}>
                        High: {highAlerts}
                      </span>
                    )}
                    {mediumAlerts > 0 && (
                      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
                        Medium: {mediumAlerts}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 6: Member Overview */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                Member Overview
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <MemberMetric label="Total Members" value={stats.usage.totalMembers} />
                <MemberMetric label="Total Helpers" value={stats.usage.totalHelpers} />
                <MemberMetric label="Active Helpers" value={stats.usage.activeHelpers} color="#16A34A" />
                <MemberMetric label="Unique Seekers" value={stats.engagement.uniqueSeekers} />
              </div>

              {/* Helper availability visualization */}
              {stats.usage.totalHelpers > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Helper Availability
                  </p>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {Array.from({ length: stats.usage.totalHelpers }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: i < stats.usage.activeHelpers ? '#16A34A' : '#E2E8F0',
                        }}
                      />
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748B' }}>
                    {stats.usage.activeHelpers} of {stats.usage.totalHelpers} helpers are currently available
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.6 }}>
            <img
              src="/peerzle-icon.svg"
              alt="Peerzle"
              style={{ width: '20px', height: '20px' }}
            />
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              Powered by Peerzle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Headline Card Component
function HeadlineCard({
  label,
  value,
  subtitle,
  color,
  showUpArrow,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  color?: string;
  showUpArrow?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 500, color: '#64748B' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 4px', fontSize: '36px', fontWeight: 700, color: color || '#1E3A5F', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {value}
        {showUpArrow && (
          <span style={{ fontSize: '24px', color: '#16A34A' }}>{'\u2191'}</span>
        )}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
        {subtitle}
      </p>
    </div>
  );
}

// Usage Metric Component
function UsageMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix: string;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: '#1E3A5F' }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
        {suffix}
      </p>
    </div>
  );
}

// Safety Metric Component
function SafetyMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#1E3A5F' }}>
        {value}
      </p>
    </div>
  );
}

// Member Metric Component
function MemberMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: color || '#1E3A5F' }}>
        {value}
      </p>
    </div>
  );
}
