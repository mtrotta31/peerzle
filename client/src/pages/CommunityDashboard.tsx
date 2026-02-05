import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Community,
  Membership,
  Conversation,
  PendingConversation,
  VerificationRequest,
  getCommunity,
  getMembership,
  startConversation,
  getActiveConversations,
  toggleAvailability,
  getPendingConversations,
  acceptConversation,
  getMyVerificationRequest,
  submitVerificationRequest,
  getOnboardingStatus,
} from '../services/api';
import { connectSocket, getSocket, HelpRequestEvent } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export default function CommunityDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [pendingConversations, setPendingConversations] = useState<PendingConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [qualifications, setQualifications] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const loadPendingConversations = async () => {
    try {
      const pending = await getPendingConversations();
      // Filter to only show pending for this community
      if (community) {
        setPendingConversations(pending.filter((p) => p.community_id === community.id));
      } else {
        setPendingConversations(pending);
      }
    } catch (err) {
      console.error('Failed to load pending conversations:', err);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        // First check onboarding status
        const onboardingStatus = await getOnboardingStatus(slug);
        if (!onboardingStatus.onboardingCompleted) {
          // Redirect to onboarding if not completed
          navigate(`/community/${slug}/onboarding`);
          return;
        }

        const [communityData, membershipData, activeConvs, verificationData] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
          getActiveConversations(),
          getMyVerificationRequest(slug),
        ]);
        setCommunity(communityData);
        setMembership(membershipData);
        setVerificationRequest(verificationData);

        // Check if user has an active conversation in this community
        const existingConv = activeConvs.find(
          (c) => c.community_id === communityData.id
        );
        if (existingConv) {
          setActiveConversation(existingConv);
        }

        // Load pending conversations if user is available as helper
        if (membershipData.is_available) {
          const pending = await getPendingConversations();
          setPendingConversations(pending.filter((p) => p.community_id === communityData.id));
        }
      } catch (err) {
        const axiosError = err as AxiosError<{ error: string }>;
        if (axiosError.response?.status === 404) {
          setError('Community not found or you are not a member');
        } else {
          setError('Failed to load community');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug, navigate]);

  // Refresh pending conversations when availability changes
  useEffect(() => {
    if (membership?.is_available && community) {
      loadPendingConversations();
      // Poll for new pending conversations every 10 seconds (fallback)
      const interval = setInterval(loadPendingConversations, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [membership?.is_available, community?.id]);

  // Listen for real-time help_request socket events
  useEffect(() => {
    if (!membership?.is_available || !community) return;

    const socket = connectSocket();

    const handleHelpRequest = (event: HelpRequestEvent) => {
      // Only handle requests for this community
      if (event.communityId !== community.id) return;

      setPendingConversations((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === event.conversationId)) return prev;

        const newPending: PendingConversation = {
          id: event.conversationId,
          community_id: event.communityId,
          seeker_membership_id: '',
          helper_membership_id: null,
          topic: event.topic,
          status: 'matching',
          started_at: event.startedAt,
          ended_at: null,
          seeker_rating: null,
          helper_rating: null,
          safety_flags: [],
          seeker_email: '',
          match_score: event.matchScore,
        };

        // Insert sorted by match score descending
        const updated = [...prev, newPending].sort(
          (a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)
        );
        return updated;
      });
    };

    socket.on('help_request', handleHelpRequest);

    return () => {
      const s = getSocket();
      s?.off('help_request', handleHelpRequest);
    };
  }, [membership?.is_available, community?.id]);

  const handleStartConversation = async (topic: string) => {
    if (!slug || isStarting) return;

    setIsStarting(true);
    try {
      const conversation = await startConversation(slug, topic);
      navigate(`/chat/${conversation.id}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; conversationId?: string }>;
      if (axiosError.response?.data?.conversationId) {
        // Already have an active conversation
        navigate(`/chat/${axiosError.response.data.conversationId}`);
      } else {
        alert(axiosError.response?.data?.error || 'Failed to start conversation');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!slug || !membership || isTogglingAvailability) return;

    // Check if trying to become available without completing training
    if (!membership.is_available && !membership.training_completed) {
      navigate(`/community/${slug}/training`);
      return;
    }

    setIsTogglingAvailability(true);
    try {
      const updated = await toggleAvailability(slug, !membership.is_available);
      setMembership(updated);

      if (updated.is_available) {
        // Load pending conversations when becoming available
        await loadPendingConversations();
      } else {
        setPendingConversations([]);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; reason?: string }>;
      if (axiosError.response?.data?.reason === 'training_required') {
        navigate(`/community/${slug}/training`);
      } else {
        console.error('Failed to toggle availability:', err);
        alert(axiosError.response?.data?.error || 'Failed to update availability');
      }
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  const handleAcceptConversation = async (conversationId: string) => {
    if (isAccepting) return;

    setIsAccepting(conversationId);
    try {
      await acceptConversation(conversationId);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      alert(axiosError.response?.data?.error || 'Failed to accept conversation');
      // Refresh pending list in case it was taken by another helper
      await loadPendingConversations();
    } finally {
      setIsAccepting(null);
    }
  };

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

  const formatTimeWaiting = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
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

  if (error || !community || !membership) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities" style={{ color: '#2B7CF6' }}>
          Back to Communities
        </Link>
      </div>
    );
  }

  const { terminology, topics } = community.config;
  const roleName = membership.role === 'helper' || membership.role === 'both'
    ? terminology.helper
    : terminology.seeker;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
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
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                {community.name}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ color: '#64748B', fontSize: '14px' }}>{user?.email}</span>
              <button
                onClick={logout}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Welcome Card with Helper Toggle */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '20px' }}>
                Welcome back
              </h2>
              <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
                Your role: <strong style={{ color: '#1E3A5F' }}>{roleName}</strong>
              </p>
            </div>

            {/* Helper Availability Toggle */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px',
              }}
            >
              {membership.training_completed ? (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: isTogglingAvailability ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: membership.is_available ? '#16A34A' : '#64748B',
                    }}
                  >
                    {membership.is_available ? 'Available to Help' : 'Not Available'}
                  </span>
                  <div
                    onClick={handleToggleAvailability}
                    style={{
                      width: '52px',
                      height: '28px',
                      backgroundColor: membership.is_available ? '#16A34A' : '#CBD5E1',
                      borderRadius: '14px',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      opacity: isTogglingAvailability ? 0.5 : 1,
                      cursor: isTogglingAvailability ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: membership.is_available ? '26px' : '2px',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                </label>
              ) : (
                <Link
                  to={`/community/${slug}/training`}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#EDF4FF',
                    color: '#2B7CF6',
                    border: 'none',
                    borderRadius: '24px',
                    textDecoration: 'none',
                    fontSize: '14px',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#DCE9FF';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#EDF4FF';
                  }}
                >
                  Complete Training
                </Link>
              )}
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                {membership.training_completed ? 'Toggle to help others' : 'Required to help others'}
              </span>
            </div>
          </div>
        </div>

        {/* Training Required Banner */}
        {!membership.training_completed && (
          <div
            style={{
              backgroundColor: '#EDF4FF',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              borderLeft: '4px solid #2B7CF6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#1E3A5F', fontSize: '16px' }}>
                  Complete Helper Training
                </h3>
                <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
                  Finish 3 short modules to start helping others in this community.
                </p>
              </div>
              <Link
                to={`/community/${slug}/training`}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
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
                Start Training
              </Link>
            </div>
          </div>
        )}

        {/* Verification Status Section - only show if community requires verification */}
        {community.helper_verification_required && !membership.is_verified_helper && (
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
                  {terminology.helper} Verification
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
        {community.helper_verification_required && membership.is_verified_helper && (
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
                Verified {terminology.helper}
              </p>
              <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '13px' }}>
                Your expertise has been verified by community administrators.
              </p>
            </div>
          </div>
        )}

        {/* Verification Application Modal */}
        {showVerificationModal && (
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
                that makes you suited to be a verified {terminology.helper.toLowerCase()}.
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
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
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
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!isSubmittingVerification) {
                      e.currentTarget.style.backgroundColor = '#1E6AD9';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#2B7CF6';
                  }}
                >
                  {isSubmittingVerification ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Requests Section */}
        {membership.is_available && pendingConversations.length > 0 && (
          <div
            style={{
              backgroundColor: 'white',
              borderLeft: '4px solid #2B7CF6',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                color: '#1E3A5F',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Pending Requests ({pendingConversations.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingConversations.map((conv) => {
                const score = conv.match_score;
                const scoreColor = score != null && score >= 80
                  ? '#16A34A'
                  : score != null && score >= 60
                  ? '#D97706'
                  : '#94A3B8';

                return (
                <div
                  key={conv.id}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ margin: 0, fontWeight: 500, color: '#1E3A5F' }}>
                        {conv.topic || 'General Support'}
                      </p>
                      {score != null && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'white',
                            backgroundColor: scoreColor,
                          }}
                          title="Shared experience in this topic"
                        >
                          {score}% match
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                      Waiting {formatTimeWaiting(conv.started_at)}
                      {score != null && (
                        <span style={{ marginLeft: '8px', color: '#94A3B8' }}>
                          &middot; Shared experience in this topic
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAcceptConversation(conv.id)}
                    disabled={isAccepting === conv.id}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '24px',
                      cursor: isAccepting === conv.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      fontSize: '14px',
                      opacity: isAccepting === conv.id ? 0.6 : 1,
                      transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (isAccepting !== conv.id) {
                        e.currentTarget.style.backgroundColor = '#15803D';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#16A34A';
                    }}
                  >
                    {isAccepting === conv.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No pending requests message */}
        {membership.is_available && pendingConversations.length === 0 && (
          <div
            style={{
              backgroundColor: '#EDF4FF',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, color: '#1E3A5F', fontWeight: 500 }}>
              You're available to help
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#64748B' }}>
              No pending requests right now. This page will refresh automatically.
            </p>
          </div>
        )}

        {/* Active Conversation Banner */}
        {activeConversation && (
          <div
            style={{
              backgroundColor: 'white',
              borderLeft: '4px solid #16A34A',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#1E3A5F' }}>
                You have an active {terminology.conversation.toLowerCase()}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>
                Topic: {activeConversation.topic || 'General Support'}
              </p>
            </div>
            <button
              onClick={() => navigate(`/chat/${activeConversation.id}`)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#2B7CF6';
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* How are you feeling today? */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#1E3A5F', fontSize: '18px' }}>
            {activeConversation ? 'Topics' : 'How are you feeling today?'}
          </h3>
          <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>
            {activeConversation
              ? 'End your current session to start a new one'
              : `Select a topic to connect with a ${terminology.helper}`}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => !activeConversation && handleStartConversation(topic)}
                disabled={isStarting || !!activeConversation}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  border: `1px solid ${activeConversation ? '#E2E8F0' : '#E2E8F0'}`,
                  borderRadius: '16px',
                  textAlign: 'left',
                  cursor: activeConversation ? 'not-allowed' : 'pointer',
                  color: activeConversation ? '#94A3B8' : '#1E3A5F',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  opacity: activeConversation ? 0.6 : 1,
                }}
                onMouseOver={(e) => {
                  if (!activeConversation) {
                    e.currentTarget.style.borderColor = '#2B7CF6';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                {topic}
              </button>
            ))}
          </div>
          {!activeConversation && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => handleStartConversation('General Support')}
                disabled={isStarting}
                style={{
                  padding: '14px 32px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: isStarting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '16px',
                  opacity: isStarting ? 0.7 : 1,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!isStarting) {
                    e.currentTarget.style.backgroundColor = '#1E6AD9';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2B7CF6';
                }}
              >
                {isStarting ? 'Starting...' : 'Start Conversation'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Link
            to={`/community/${slug}/history`}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '24px',
              textDecoration: 'none',
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
            Session History
          </Link>
          <Link
            to={`/community/${slug}/training`}
            style={{
              padding: '10px 20px',
              backgroundColor: membership.training_completed ? 'white' : '#EDF4FF',
              color: membership.training_completed ? '#64748B' : '#2B7CF6',
              border: membership.training_completed ? '1px solid #E2E8F0' : 'none',
              borderRadius: '24px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#2B7CF6';
              e.currentTarget.style.color = '#2B7CF6';
            }}
            onMouseOut={(e) => {
              if (membership.training_completed) {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.color = '#64748B';
              } else {
                e.currentTarget.style.color = '#2B7CF6';
              }
            }}
          >
            Helper Training
          </Link>
          {(membership.is_available || membership.role === 'helper' || membership.role === 'both' || membership.role === 'admin') && (
            <Link
              to={`/community/${slug}/helper-dashboard`}
              style={{
                padding: '10px 20px',
                backgroundColor: 'white',
                color: '#64748B',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                textDecoration: 'none',
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
              Helper Dashboard
            </Link>
          )}
          {membership.role === 'admin' && (
            <Link
              to={`/community/${slug}/admin`}
              style={{
                padding: '10px 20px',
                backgroundColor: 'white',
                color: '#64748B',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                textDecoration: 'none',
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
              Admin Dashboard
            </Link>
          )}
          <Link
            to="/communities"
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#64748B',
              border: '1px solid #E2E8F0',
              borderRadius: '24px',
              textDecoration: 'none',
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
            All Communities
          </Link>
        </div>
      </main>
    </div>
  );
}
