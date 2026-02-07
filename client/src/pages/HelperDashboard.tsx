import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Community,
  Membership,
  HelperDashboardStats,
  VerificationRequest,
  getCommunity,
  getMembership,
  getHelperDashboard,
  getMyVerificationRequest,
  submitVerificationRequest,
} from '../services/api';
import { AxiosError } from 'axios';

const BADGE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  great_listener: { emoji: '\uD83C\uDFAF', label: 'Great Listener' },
  helpful_advice: { emoji: '\uD83D\uDCA1', label: 'Helpful Advice' },
  felt_heard: { emoji: '\u2764\uFE0F', label: 'Made Me Feel Heard' },
  above_beyond: { emoji: '\uD83C\uDF1F', label: 'Above & Beyond' },
  easy_to_talk: { emoji: '\uD83E\uDD1D', label: 'Easy to Talk To' },
  understood_me: { emoji: '\uD83E\uDDE0', label: 'Understood Me' },
};

export default function HelperDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [stats, setStats] = useState<HelperDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Verification state
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [qualifications, setQualifications] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, membershipData, statsData, verificationData] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
          getHelperDashboard(slug),
          getMyVerificationRequest(slug),
        ]);
        setCommunity(communityData);
        setMembership(membershipData);
        setStats(statsData);
        setVerificationRequest(verificationData);
      } catch (err) {
        console.error('Failed to load helper dashboard:', err);
        setError('Failed to load dashboard');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const handleSubmitVerification = async () => {
    if (!slug || isSubmittingVerification) return;

    if (qualifications.trim().length < 10) {
      setVerificationError('Please provide at least 10 characters describing your qualifications');
      return;
    }

    setIsSubmittingVerification(true);
    setVerificationError('');

    try {
      const request = await submitVerificationRequest(slug, qualifications.trim());
      setVerificationRequest(request);
      setShowVerificationModal(false);
      setQualifications('');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setVerificationError(axiosError.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

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
        {/* Verification Status Section - show if community requires verification */}
        {community.helper_verification_required && membership && !membership.is_verified_helper && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              borderLeft: verificationRequest?.status === 'pending'
                ? '4px solid #F59E0B'
                : verificationRequest?.status === 'denied'
                ? '4px solid #DC2626'
                : '4px solid #2B7CF6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '16px' }}>
                  {community.config.terminology.helper} Verification
                </h3>
                {!verificationRequest && (
                  <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
                    Get verified to show your expertise and build trust with those you help.
                  </p>
                )}
                {verificationRequest?.status === 'pending' && (
                  <p style={{ margin: 0, color: '#F59E0B', fontSize: '14px', fontWeight: 500 }}>
                    Your verification request is pending review.
                  </p>
                )}
                {verificationRequest?.status === 'denied' && (
                  <div>
                    <p style={{ margin: '0 0 8px 0', color: '#DC2626', fontSize: '14px', fontWeight: 500 }}>
                      Your verification request was not approved.
                    </p>
                    {verificationRequest.reviewNotes && (
                      <p style={{ margin: 0, color: '#64748B', fontSize: '13px', fontStyle: 'italic' }}>
                        "{verificationRequest.reviewNotes}"
                      </p>
                    )}
                  </div>
                )}
              </div>
              {(!verificationRequest || verificationRequest.status === 'denied') && (
                <button
                  onClick={() => {
                    setShowVerificationModal(true);
                    setVerificationError('');
                    setQualifications('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2B7CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    fontSize: '14px',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#1E6AD9';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#2B7CF6';
                  }}
                >
                  {verificationRequest?.status === 'denied' ? 'Reapply' : 'Apply for Verification'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Verified Helper Badge */}
        {community.helper_verification_required && membership?.is_verified_helper && (
          <div
            style={{
              backgroundColor: '#ECFDF5',
              borderRadius: '16px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '20px' }}>✓</span>
            <div>
              <p style={{ margin: 0, color: '#16A34A', fontSize: '14px', fontWeight: 600 }}>
                Verified {community.config.terminology.helper}
              </p>
              <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '13px' }}>
                Your expertise has been verified by community administrators.
              </p>
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

            {/* Average Mood Improvement */}
            {stats.averageMoodImprovement !== null && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  borderLeft: `4px solid ${stats.averageMoodImprovement >= 0 ? '#16A34A' : '#F59E0B'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>
                    {stats.averageMoodImprovement >= 0 ? '\u2B06\uFE0F' : '\u2B07\uFE0F'}
                  </span>
                  <span style={{ color: '#1E3A5F' }}>Avg Mood Change</span>
                </div>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    color: stats.averageMoodImprovement >= 0 ? '#16A34A' : '#F59E0B',
                  }}
                >
                  {stats.averageMoodImprovement > 0 ? '+' : ''}{stats.averageMoodImprovement.toFixed(1)}
                </span>
              </div>
            )}

            {/* Badges Received */}
            {stats.badgeCounts.length > 0 && (
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', color: '#1E3A5F', fontWeight: 600 }}>Badges Received</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {stats.badgeCounts.map(({ badge, count }) => {
                    const display = BADGE_DISPLAY[badge] || { emoji: '', label: badge };
                    return (
                      <div
                        key={badge}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{display.emoji}</span>
                        <span style={{ fontSize: '13px', color: '#1E3A5F', fontWeight: 500 }}>{display.label}</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '20px',
                            height: '20px',
                            borderRadius: '10px',
                            backgroundColor: '#2B7CF6',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '0 5px',
                          }}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* Verification Application Modal */}
      {showVerificationModal && community && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVerificationModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '20px' }}>
              Apply for Verification
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
              Tell us about your qualifications, training, certifications, or relevant experience
              that makes you suited to be a verified {community.config.terminology.helper.toLowerCase()}.
            </p>

            <textarea
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="Describe your qualifications, certifications, training, and relevant experience..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '12px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2B7CF6';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            />

            {verificationError && (
              <p style={{ margin: '12px 0 0', color: '#DC2626', fontSize: '13px' }}>
                {verificationError}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '20px',
              }}
            >
              <button
                onClick={() => setShowVerificationModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitVerification}
                disabled={isSubmittingVerification}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: isSubmittingVerification ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  opacity: isSubmittingVerification ? 0.6 : 1,
                }}
              >
                {isSubmittingVerification ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
