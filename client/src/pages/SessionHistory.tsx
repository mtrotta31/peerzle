import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Community, HistoryConversation, getCommunity, getSessionHistory } from '../services/api';

const MOOD_EMOJIS: Record<number, string> = {
  1: '\uD83D\uDE2B',
  2: '\uD83D\uDE1F',
  3: '\uD83D\uDE10',
  4: '\uD83D\uDE42',
  5: '\uD83D\uDE0A',
};

const BADGE_EMOJIS: Record<string, string> = {
  great_listener: '\uD83C\uDFAF',
  helpful_advice: '\uD83D\uDCA1',
  felt_heard: '\u2764\uFE0F',
  above_beyond: '\uD83C\uDF1F',
  easy_to_talk: '\uD83E\uDD1D',
  understood_me: '\uD83E\uDDE0',
};

const BADGE_LABELS: Record<string, string> = {
  great_listener: 'Great Listener',
  helpful_advice: 'Helpful Advice',
  felt_heard: 'Made Me Feel Heard',
  above_beyond: 'Above & Beyond',
  easy_to_talk: 'Easy to Talk To',
  understood_me: 'Understood Me',
};

export default function SessionHistory() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [history, setHistory] = useState<HistoryConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, historyData] = await Promise.all([
          getCommunity(slug),
          getSessionHistory(slug),
        ]);
        setCommunity(communityData);
        setHistory(historyData);
      } catch (err) {
        console.error('Failed to load history:', err);
        setError('Failed to load session history');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'Unknown duration';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Less than a minute';
    if (diffMins === 1) return '1 minute';
    if (diffMins < 60) return `${diffMins} minutes`;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 1 && mins === 0) return '1 hour';
    if (mins === 0) return `${hours} hours`;
    return `${hours}h ${mins}m`;
  };

  const renderStars = (rating: number) => {
    return (
      <span style={{ fontSize: '16px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} style={{ color: star <= rating ? '#F59E0B' : '#D1D5DB' }}>
            ★
          </span>
        ))}
      </span>
    );
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
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities" style={{ color: '#2B7CF6' }}>Back to Communities</Link>
      </div>
    );
  }

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
            maxWidth: '800px',
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
                Session History
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                {community.name}
              </p>
            </div>
          </div>
          <Link
            to={`/community/${slug}`}
            style={{
              color: '#64748B',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              backgroundColor: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: '50%',
              fontSize: '20px',
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
            aria-label="Back to Dashboard"
          >
            ‹
          </Link>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Saved filter */}
        {history.length > 0 && history.some((s) => s.is_saved) && (
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowSavedOnly(false)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: `1px solid ${!showSavedOnly ? '#2B7CF6' : '#E2E8F0'}`,
                backgroundColor: !showSavedOnly ? '#EDF4FF' : 'white',
                color: !showSavedOnly ? '#2B7CF6' : '#64748B',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              All Sessions
            </button>
            <button
              onClick={() => setShowSavedOnly(true)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: `1px solid ${showSavedOnly ? '#2B7CF6' : '#E2E8F0'}`,
                backgroundColor: showSavedOnly ? '#EDF4FF' : 'white',
                color: showSavedOnly ? '#2B7CF6' : '#64748B',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Saved
            </button>
          </div>
        )}

        {history.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>No past sessions yet</h2>
            <p style={{ margin: 0, color: '#64748B' }}>
              Your completed sessions will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history
              .filter((s) => !showSavedOnly || s.is_saved)
              .map((session) => {
              const moodChange = (session.seeker_pre_mood != null && session.seeker_post_mood != null)
                ? session.seeker_post_mood - session.seeker_pre_mood
                : null;

              return (
              <div
                key={session.id}
                onClick={() => navigate(`/chat/${session.id}`)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {/* Topic and Role Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, color: '#1E3A5F', fontSize: '16px', fontWeight: 600 }}>
                        {session.topic || 'General Support'}
                      </h3>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: session.role === 'seeker' ? '#DCE9FF' : '#E9E0FF',
                          color: session.role === 'seeker' ? '#1E3A5F' : '#7C5CFC',
                        }}
                      >
                        {session.role === 'seeker' ? 'Seeker' : 'Helper'}
                      </span>
                      {session.is_saved && (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: '#ECFDF5',
                            color: '#16A34A',
                          }}
                        >
                          Saved
                        </span>
                      )}
                    </div>

                    {/* Date and Duration */}
                    <p style={{ margin: '0 0 4px 0', color: '#64748B', fontSize: '14px' }}>
                      {session.ended_at ? formatDate(session.ended_at) : formatDate(session.started_at)}
                    </p>
                    <p style={{ margin: '0 0 8px 0', color: '#64748B', fontSize: '13px' }}>
                      Duration: {formatDuration(session.started_at, session.ended_at)}
                      {session.other_user_display_name ? (
                        <span> · with {session.other_user_display_name}</span>
                      ) : session.role === 'seeker' ? (
                        <span> · PeerBot only</span>
                      ) : (
                        <span> · with Anonymous Peer</span>
                      )}
                    </p>

                    {/* Mood Change */}
                    {session.seeker_pre_mood != null && session.seeker_post_mood != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px' }}>
                          {MOOD_EMOJIS[session.seeker_pre_mood]} → {MOOD_EMOJIS[session.seeker_post_mood]}
                        </span>
                        {moodChange != null && moodChange !== 0 && (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: moodChange > 0 ? '#16A34A' : '#DC2626',
                            }}
                          >
                            {moodChange > 0 ? '+' : ''}{moodChange} mood
                          </span>
                        )}
                      </div>
                    )}

                    {/* Compliment Badges */}
                    {session.helper_compliment_badges && session.helper_compliment_badges.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {session.helper_compliment_badges.map((badge) => (
                          <span
                            key={badge}
                            title={BADGE_LABELS[badge] || badge}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#F8FAFC',
                              fontSize: '12px',
                              color: '#64748B',
                            }}
                          >
                            {BADGE_EMOJIS[badge] || ''} {BADGE_LABELS[badge] || badge}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rating */}
                    <div style={{ marginTop: '4px' }}>
                      {session.rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderStars(session.rating)}
                          <span style={{ color: '#64748B', fontSize: '13px' }}>
                            Your rating
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic' }}>
                          No rating
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
