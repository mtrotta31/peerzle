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
    if (rating === null) return <span style={{ color: '#9ca3af', fontSize: '14px' }}>No rating</span>;
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

  const renderAverageStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0) - (rating - fullStars >= 0.75 ? 1 : 0);
    const almostFull = rating - fullStars >= 0.75;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '28px', color: '#fbbf24' }}>
          {'★'.repeat(fullStars)}
          {almostFull && '★'}
          {hasHalf && '★'}
          <span style={{ color: '#d1d5db' }}>{'★'.repeat(emptyStars)}</span>
        </span>
        <span style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937', marginLeft: '8px' }}>
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error || !community || !stats) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities">Back to Communities</Link>
      </div>
    );
  }

  const { branding } = community.config;
  const hasNoSessions = stats.totalSessions === 0;

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
              <h1 style={{ margin: 0 }}>Helper Dashboard</h1>
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
        {hasNoSessions ? (
          /* Empty State */
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#374151' }}>
              You haven't completed any sessions yet
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280' }}>
              Toggle "Available to Help" on the dashboard to get started helping others!
            </p>
            <Link
              to={`/community/${slug}`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: branding.primaryColor,
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontWeight: 500,
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
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>💬</span>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Sessions Completed</span>
                </div>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#1f2937' }}>
                  {stats.totalSessions}
                </p>
                {stats.activeSessions > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#059669' }}>
                    {stats.activeSessions} active now
                  </p>
                )}
              </div>

              {/* Average Rating */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>⭐</span>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Average Rating</span>
                </div>
                {stats.averageRating !== null ? (
                  <>
                    {renderAverageStars(stats.averageRating)}
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                      from {stats.totalRatings} rating{stats.totalRatings !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '16px', color: '#9ca3af' }}>No ratings yet</p>
                )}
              </div>

              {/* Felt Heard Rate */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>👂</span>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Felt Heard Rate</span>
                </div>
                {stats.feltHeardPercent !== null ? (
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#059669' }}>
                    {stats.feltHeardPercent}%
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '16px', color: '#9ca3af' }}>No data yet</p>
                )}
              </div>

              {/* Total Help Time */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>⏱️</span>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Total Help Time</span>
                </div>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 600, color: '#1f2937' }}>
                  {formatHelpTime(stats.totalHelpTime)}
                </p>
              </div>
            </div>

            {/* Would Recommend (if available) */}
            {stats.wouldRecommendPercent !== null && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>👍</span>
                  <span style={{ color: '#374151' }}>Seekers who would recommend Peerzle</span>
                </div>
                <span style={{ fontSize: '24px', fontWeight: 600, color: '#059669' }}>
                  {stats.wouldRecommendPercent}%
                </span>
              </div>
            )}

            {/* Recent Sessions */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>Recent Sessions</h3>
              {stats.recentSessions.length === 0 ? (
                <p style={{ color: '#6b7280', margin: 0 }}>No recent sessions</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.recentSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/chat/${session.id}`)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 500, color: '#1f2937' }}>
                          {session.topic || 'General Support'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
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
