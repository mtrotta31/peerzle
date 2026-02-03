import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Community, HelperDashboardStats, getCommunity, getHelperDashboard } from '../services/api';

export default function HelperDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [stats, setStats] = useState<HelperDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, statsData] = await Promise.all([
          getCommunity(slug),
          getHelperDashboard(slug),
        ]);
        setCommunity(communityData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to load helper dashboard:', err);
        setError('Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const formatHelpTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span style={{ color: '#94A3B8', fontSize: '14px', fontStyle: 'italic' }}>No rating</span>;
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

  const renderAverageStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0) - (rating - fullStars >= 0.75 ? 1 : 0);
    const almostFull = rating - fullStars >= 0.75;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '28px', color: '#F59E0B' }}>
          {'★'.repeat(fullStars)}
          {almostFull && '★'}
          {hasHalf && '★'}
          <span style={{ color: '#D1D5DB' }}>{'★'.repeat(emptyStars)}</span>
        </span>
        <span style={{ fontSize: '24px', fontWeight: 600, color: '#1E3A5F', marginLeft: '8px' }}>
          {rating.toFixed(1)}
        </span>
      </div>
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

  if (error || !community || !stats) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities" style={{ color: '#2B7CF6' }}>Back to Communities</Link>
      </div>
    );
  }

  const hasNoSessions = stats.totalSessions === 0;

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
                Helper Dashboard
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
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px' }}>
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
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>
              You haven't completed any sessions yet
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#64748B' }}>
              Toggle "Available to Help" on the dashboard to get started helping others!
            </p>
            <Link
              to={`/community/${slug}`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '24px',
                fontWeight: 500,
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#2B7CF6';
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              {/* Sessions Completed */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderTop: '3px solid #2B7CF6',
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                  Sessions Completed
                </p>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#1E3A5F' }}>
                  {stats.totalSessions}
                </p>
                {stats.activeSessions > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#16A34A' }}>
                    {stats.activeSessions} active now
                  </p>
                )}
              </div>

              {/* Average Rating */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderTop: '3px solid #F59E0B',
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                  Average Rating
                </p>
                {stats.averageRating !== null ? (
                  <>
                    {renderAverageStars(stats.averageRating)}
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                      from {stats.totalRatings} rating{stats.totalRatings !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '16px', color: '#94A3B8', fontStyle: 'italic' }}>No ratings yet</p>
                )}
              </div>

              {/* Felt Heard Rate */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderTop: '3px solid #16A34A',
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                  Felt Heard Rate
                </p>
                {stats.feltHeardPercent !== null ? (
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#1E3A5F' }}>
                    {stats.feltHeardPercent}%
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '16px', color: '#94A3B8', fontStyle: 'italic' }}>No data yet</p>
                )}
              </div>

              {/* Total Help Time */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderTop: '3px solid #64748B',
                }}
              >
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                  Total Help Time
                </p>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#1E3A5F' }}>
                  {formatHelpTime(stats.totalHelpTime)}
                </p>
              </div>
            </div>

            {/* Would Recommend (if available) */}
            {stats.wouldRecommendPercent !== null && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderLeft: '4px solid #16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>👍</span>
                  <span style={{ color: '#1E3A5F' }}>Seekers who would recommend Peerzle</span>
                </div>
                <span style={{ fontSize: '24px', fontWeight: 600, color: '#16A34A' }}>
                  {stats.wouldRecommendPercent}%
                </span>
              </div>
            )}

            {/* Recent Sessions */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', color: '#1E3A5F', fontWeight: 600 }}>Recent Sessions</h3>
              {stats.recentSessions.length === 0 ? (
                <p style={{ color: '#64748B', margin: 0 }}>No recent sessions</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.recentSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/chat/${session.id}`)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#EDF4FF';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: '#1E3A5F' }}>
                          {session.topic || 'General Support'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                          {formatDate(session.ended_at)}
                        </p>
                      </div>
                      <div>{renderStars(session.seeker_rating)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
