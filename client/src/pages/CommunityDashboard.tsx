import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Community,
  Membership,
  Conversation,
  PendingConversation,
  getCommunity,
  getMembership,
  startConversation,
  getActiveConversations,
  toggleAvailability,
  getPendingConversations,
  acceptConversation,
  getOnboardingStatus,
} from '../services/api';
import { connectSocket, getSocket, HelpRequestEvent } from '../services/socket';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  isPushEnabled,
} from '../services/push';
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
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Check if we should show the push notification banner
  useEffect(() => {
    async function checkPushStatus() {
      console.log('[PUSH DEBUG] Checking push status...');

      // Only show on supported browsers
      const supported = isPushSupported();
      console.log('[PUSH DEBUG] isPushSupported:', supported);
      if (!supported) {
        console.log('[PUSH DEBUG] Exiting: Push not supported');
        return;
      }

      // Don't show if user already dismissed it
      const dismissed = localStorage.getItem('pushBannerDismissed');
      console.log('[PUSH DEBUG] localStorage pushBannerDismissed:', dismissed);
      if (dismissed) {
        console.log('[PUSH DEBUG] Exiting: Banner was dismissed');
        return;
      }

      // Don't show if permission is denied (can't re-ask)
      const permission = getNotificationPermission();
      console.log('[PUSH DEBUG] Notification.permission:', permission);
      if (permission === 'denied') {
        console.log('[PUSH DEBUG] Exiting: Permission denied');
        return;
      }

      // Don't show if already enabled
      const enabled = await isPushEnabled();
      console.log('[PUSH DEBUG] isPushEnabled:', enabled);
      if (enabled) {
        console.log('[PUSH DEBUG] Exiting: Push already enabled');
        return;
      }

      // Show the banner
      console.log('[PUSH DEBUG] All checks passed, showing banner');
      setShowPushBanner(true);
    }

    checkPushStatus();
  }, []);

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        const success = await subscribeToPush();
        if (success) {
          setShowPushBanner(false);
        }
      } else {
        // Permission denied, hide banner permanently
        localStorage.setItem('pushBannerDismissed', 'true');
        setShowPushBanner(false);
      }
    } catch (err) {
      console.error('Failed to enable push:', err);
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleDismissPushBanner = () => {
    localStorage.setItem('pushBannerDismissed', 'true');
    setShowPushBanner(false);
  };

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

        const [communityData, membershipData, activeConvs] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
          getActiveConversations(),
        ]);
        setCommunity(communityData);
        setMembership(membershipData);

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
          seeker_name: 'Anonymous',
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
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
                  {community.name}
                </h1>
                {membership.organization?.name && (
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                    {membership.organization.name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                padding: '8px 12px',
                backgroundColor: 'white',
                color: '#64748B',
                border: '1px solid #E2E8F0',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            style={{
              padding: '14px 20px',
              backgroundColor: 'transparent',
              color: '#2B7CF6',
              border: 'none',
              borderBottom: '2px solid #2B7CF6',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            Home
          </button>
          <Link
            to={`/community/${slug}/history`}
            style={{
              padding: '14px 20px',
              backgroundColor: 'transparent',
              color: '#64748B',
              border: 'none',
              borderBottom: '2px solid transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#2B7CF6';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#64748B';
            }}
          >
            Past Sessions
          </Link>
          {(membership.is_available || membership.role === 'helper' || membership.role === 'both' || membership.role === 'admin') && (
            <Link
              to={`/community/${slug}/helper-dashboard`}
              style={{
                padding: '14px 20px',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                borderBottom: '2px solid transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#2B7CF6';
              }}
              onMouseOut={(e) => {
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
                padding: '14px 20px',
                backgroundColor: 'transparent',
                color: '#64748B',
                border: 'none',
                borderBottom: '2px solid transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#2B7CF6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#64748B';
              }}
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* Push Notification Banner */}
      {showPushBanner && (
        <div
          style={{
            backgroundColor: '#EDF4FF',
            borderBottom: '1px solid #DCE9FF',
            padding: '12px 24px',
          }}
        >
          <div
            style={{
              maxWidth: '800px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>&#128276;</span>
              <p style={{ margin: 0, color: '#1E3A5F', fontSize: '14px' }}>
                {membership?.role === 'helper' || membership?.role === 'both'
                  ? 'As a helper, notifications let you respond quickly when someone reaches out'
                  : 'Turn on notifications so you never miss someone who needs help'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDismissPushBanner}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Not now
              </button>
              <button
                onClick={handleEnablePush}
                disabled={isEnablingPush}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: isEnablingPush ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  opacity: isEnablingPush ? 0.7 : 1,
                }}
              >
                {isEnablingPush ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                      {conv.same_org ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#16A34A',
                            backgroundColor: '#DCFCE7',
                          }}
                        >
                          Your org
                        </span>
                      ) : conv.org_name ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#64748B',
                            backgroundColor: '#F1F5F9',
                          }}
                        >
                          {conv.org_name}
                        </span>
                      ) : null}
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

      </main>
    </div>
  );
}
