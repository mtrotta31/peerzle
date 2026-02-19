import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Community,
  HelperDashboardStats,
  PendingConversation,
  getCommunity,
  getHelperDashboard,
  getPendingConversations,
  acceptConversation,
} from '../services/api';

const BADGE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  great_listener: { emoji: '🎯', label: 'Great Listener' },
  helpful_advice: { emoji: '💡', label: 'Helpful Advice' },
  felt_heard: { emoji: '❤️', label: 'Made Me Feel Heard' },
  above_beyond: { emoji: '🌟', label: 'Above & Beyond' },
  easy_to_talk: { emoji: '🤝', label: 'Easy to Talk To' },
  understood_me: { emoji: '🧠', label: 'Understood Me' },
};

const ALL_BADGES = Object.keys(BADGE_DISPLAY);

const COACHING_TIPS = [
  'Start by validating their feelings before offering solutions.',
  'Ask open-ended questions to understand their perspective better.',
  'Reflect back what you hear to show you\'re listening.',
  'It\'s okay to sit in silence - sometimes presence is enough.',
  'Avoid giving advice unless they explicitly ask for it.',
  'Focus on their strengths and what\'s working in their life.',
  'Share your own experiences sparingly and only when relevant.',
  'Help them identify small, actionable next steps.',
  'Remember: you don\'t need to fix everything, just be present.',
  'End conversations by acknowledging their courage in reaching out.',
  'Notice and name the emotions you hear in their words.',
  'Take care of yourself too - helper burnout is real.',
];

export default function HelperPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [stats, setStats] = useState<HelperDashboardStats | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [coachingTipIndex, setCoachingTipIndex] = useState(() =>
    Math.floor(Math.random() * COACHING_TIPS.length)
  );

  const loadData = useCallback(async () => {
    if (!slug) return;

    try {
      const [communityData, statsData, pendingData] = await Promise.all([
        getCommunity(slug),
        getHelperDashboard(slug),
        getPendingConversations(),
      ]);
      setCommunity(communityData);
      setStats(statsData);
      // Filter pending to only this community
      setPendingRequests(pendingData.filter((p) => p.community_slug === slug));
    } catch (err) {
      console.error('Failed to load helper page:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcceptRequest = async (conversationId: string) => {
    setAcceptingId(conversationId);
    try {
      await acceptConversation(conversationId);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      console.error('Failed to accept conversation:', err);
      setAcceptingId(null);
    }
  };

  const rotateTip = () => {
    setCoachingTipIndex((prev) => (prev + 1) % COACHING_TIPS.length);
  };

  const accentColor = community?.config?.branding?.primaryColor || '#2B7CF6';

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
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  if (error || !community || !stats) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', marginBottom: '16px' }}>{error || 'Something went wrong'}</p>
        <button
          onClick={() => navigate(`/community/${slug}`)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2B7CF6',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const hasNoSessions = stats.totalSessions === 0;

  // Build badge counts map for easy lookup
  const badgeCountMap = new Map(stats.badgeCounts.map((b) => [b.badge, b.count]));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', paddingBottom: '100px' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>⭐</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              Your Impact
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
              Thank you for helping others in {community.name}
            </p>
          </div>
        </div>
      </header>

      <div style={{ padding: '16px 20px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: '16px',
                padding: '16px',
                borderLeft: `4px solid #F59E0B`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '18px' }}>🔔</span>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#92400E' }}>
                  {pendingRequests.length} Peer{pendingRequests.length !== 1 ? 's' : ''} Need{pendingRequests.length === 1 ? 's' : ''} Help
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 500, color: '#1E3A5F', fontSize: '14px' }}>
                        {request.topic || 'General Support'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                        {request.seeker_name}
                        {request.match_score && (
                          <span
                            style={{
                              marginLeft: '8px',
                              backgroundColor: '#DBEAFE',
                              color: '#1D4ED8',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 500,
                            }}
                          >
                            {request.match_score}% match
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={acceptingId === request.id}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: accentColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: acceptingId === request.id ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                        fontSize: '13px',
                        opacity: acceptingId === request.id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {acceptingId === request.id ? 'Connecting...' : 'Accept'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasNoSessions ? (
          /* Empty State */
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌟</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>Ready to Make a Difference?</h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748B', lineHeight: 1.5 }}>
              Toggle "Available to Help" on the dashboard to start connecting with peers who need support.
            </p>
            <button
              onClick={() => navigate(`/community/${slug}`)}
              style={{
                padding: '12px 24px',
                backgroundColor: accentColor,
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '15px',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Impact Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {/* Peers Helped */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: '24px' }}>🤝</span>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#1E3A5F',
                  }}
                >
                  {stats.totalSessions}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>
                  Peers Helped
                </p>
              </div>

              {/* Response Streak */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: '24px' }}>🔥</span>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: stats.responseStreak > 0 ? '#F59E0B' : '#1E3A5F',
                  }}
                >
                  {stats.responseStreak}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>
                  Day Streak
                </p>
              </div>

              {/* Average Rating */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <span style={{ fontSize: '24px' }}>⭐</span>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#1E3A5F',
                  }}
                >
                  {stats.averageRating !== null ? stats.averageRating.toFixed(1) : '-'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748B' }}>
                  Avg Rating
                </p>
              </div>
            </div>

            {/* Compliment Badges */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <h3
                style={{
                  margin: '0 0 16px 0',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1E3A5F',
                }}
              >
                Compliment Badges
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                }}
              >
                {ALL_BADGES.map((badgeKey) => {
                  const display = BADGE_DISPLAY[badgeKey];
                  const count = badgeCountMap.get(badgeKey) || 0;
                  const hasEarned = count > 0;
                  return (
                    <div
                      key={badgeKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        backgroundColor: hasEarned ? '#F8FAFC' : '#FAFAFA',
                        borderRadius: '12px',
                        border: hasEarned ? `1px solid ${accentColor}20` : '1px solid #E2E8F0',
                        opacity: hasEarned ? 1 : 0.5,
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{display.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#1E3A5F',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {display.label}
                        </p>
                        {hasEarned && (
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                            {count} time{count !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      {hasEarned && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '24px',
                            height: '24px',
                            borderRadius: '12px',
                            backgroundColor: accentColor,
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '0 6px',
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coaching Tip */}
            <div
              style={{
                backgroundColor: '#FEF9C3',
                borderRadius: '16px',
                padding: '16px',
                borderLeft: '4px solid #EAB308',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🎓</span>
                  <div>
                    <p
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#92400E',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Coaching Tip
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#78350F',
                        lineHeight: 1.5,
                      }}
                    >
                      {COACHING_TIPS[coachingTipIndex]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={rotateTip}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#92400E',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Next tip
                </button>
              </div>
            </div>

            {/* Additional Stats */}
            {(stats.averageMoodImprovement !== null || stats.feltHeardPercent !== null) && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1E3A5F',
                  }}
                >
                  Your Impact
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.averageMoodImprovement !== null && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#F0FDF4',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>
                          {stats.averageMoodImprovement >= 0 ? '📈' : '📉'}
                        </span>
                        <span style={{ fontSize: '14px', color: '#1E3A5F' }}>
                          Avg Mood Change
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '18px',
                          fontWeight: 600,
                          color: stats.averageMoodImprovement >= 0 ? '#16A34A' : '#F59E0B',
                        }}
                      >
                        {stats.averageMoodImprovement > 0 ? '+' : ''}
                        {stats.averageMoodImprovement.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {stats.feltHeardPercent !== null && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#EFF6FF',
                        borderRadius: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>💙</span>
                        <span style={{ fontSize: '14px', color: '#1E3A5F' }}>Felt Heard</span>
                      </div>
                      <span style={{ fontSize: '18px', fontWeight: 600, color: '#2563EB' }}>
                        {stats.feltHeardPercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
