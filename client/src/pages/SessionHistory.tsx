import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Community, HistoryConversation, getCommunity, getSessionHistory } from '../services/api';

export default function SessionHistory() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [history, setHistory] = useState<HistoryConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
      <span style={{ color: '#fbbf24', fontSize: '16px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} style={{ color: star <= rating ? '#fbbf24' : '#d1d5db' }}>
            ★
          </span>
        ))}
      </span>
    );
  };

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error || !community) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities">Back to Communities</Link>
      </div>
    );
  }

  const { branding } = community.config;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: branding.primaryColor,
          color: 'white',
          padding: '20px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0 }}>Session History</h1>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                {community.name}
              </p>
            </div>
            <Link
              to={`/community/${slug}`}
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid white',
                borderRadius: '4px',
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {history.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#374151' }}>No past sessions yet</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Your completed sessions will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.map((session) => (
              <div
                key={session.id}
                onClick={() => navigate(`/chat/${session.id}`)}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {/* Topic and Role Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, color: '#1f2937', fontSize: '16px' }}>
                        {session.topic || 'General Support'}
                      </h3>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: session.role === 'seeker' ? '#dbeafe' : '#d1fae5',
                          color: session.role === 'seeker' ? '#1e40af' : '#065f46',
                        }}
                      >
                        {session.role === 'seeker' ? 'Seeker' : 'Helper'}
                      </span>
                    </div>

                    {/* Date and Duration */}
                    <p style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '14px' }}>
                      {session.ended_at ? formatDate(session.ended_at) : formatDate(session.started_at)}
                    </p>
                    <p style={{ margin: '0 0 8px 0', color: '#9ca3af', fontSize: '13px' }}>
                      Duration: {formatDuration(session.started_at, session.ended_at)}
                      {session.other_user_email && (
                        <span> · with {session.other_user_email}</span>
                      )}
                      {!session.other_user_email && (
                        <span> · PeerBot only</span>
                      )}
                    </p>

                    {/* Rating */}
                    <div style={{ marginTop: '8px' }}>
                      {session.rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderStars(session.rating)}
                          <span style={{ color: '#6b7280', fontSize: '13px' }}>
                            Your rating
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>
                          No rating
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
