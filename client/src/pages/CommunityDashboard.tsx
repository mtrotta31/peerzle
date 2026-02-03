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
} from '../services/api';
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
  const { user } = useAuth();
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
  }, [slug]);

  // Refresh pending conversations when availability changes
  useEffect(() => {
    if (membership?.is_available && community) {
      loadPendingConversations();
      // Poll for new pending conversations every 10 seconds
      const interval = setInterval(loadPendingConversations, 10000);
      return () => clearInterval(interval);
    }
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
      console.error('Failed to toggle availability:', err);
      alert('Failed to update availability');
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
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error || !community || !membership) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities">Back to Communities</Link>
      </div>
    );
  }

  const { branding, terminology, topics } = community.config;
  const roleName = membership.role === 'helper' || membership.role === 'both'
    ? terminology.helper
    : terminology.seeker;

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
            <h1 style={{ margin: 0 }}>{community.name}</h1>
            <Link
              to="/communities"
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid white',
                borderRadius: '4px',
              }}
            >
              Back to Communities
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {/* Welcome Card with Helper Toggle */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', color: branding.primaryColor }}>
                Welcome, {user?.email}
              </h2>
              <p style={{ margin: 0, color: '#666' }}>
                Your role: <strong>{roleName}</strong>
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
                    color: membership.is_available ? '#059669' : '#6b7280',
                  }}
                >
                  {membership.is_available ? 'Available to Help' : 'Not Available'}
                </span>
                <div
                  onClick={handleToggleAvailability}
                  style={{
                    width: '48px',
                    height: '26px',
                    backgroundColor: membership.is_available ? '#059669' : '#d1d5db',
                    borderRadius: '13px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    opacity: isTogglingAvailability ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: membership.is_available ? '24px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
              </label>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Toggle to help others
              </span>
            </div>
          </div>
        </div>

        {/* Pending Requests Section */}
        {membership.is_available && pendingConversations.length > 0 && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🆘</span>
              Pending Requests ({pendingConversations.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingConversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 500, color: '#1f2937' }}>
                      {conv.topic || 'General Support'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                      Waiting {formatTimeWaiting(conv.started_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAcceptConversation(conv.id)}
                    disabled={isAccepting === conv.id}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: isAccepting === conv.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: isAccepting === conv.id ? 0.6 : 1,
                    }}
                  >
                    {isAccepting === conv.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No pending requests message */}
        {membership.is_available && pendingConversations.length === 0 && (
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, color: '#166534' }}>
              You're available to help. No pending requests right now.
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#4ade80' }}>
              This page will automatically refresh when someone needs help.
            </p>
          </div>
        )}

        {/* Active Conversation Banner */}
        {activeConversation && (
          <div
            style={{
              backgroundColor: branding.secondaryColor,
              color: 'white',
              borderRadius: '8px',
              padding: '16px 24px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                You have an active {terminology.conversation.toLowerCase()}
              </p>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                Topic: {activeConversation.topic || 'General Support'}
              </p>
            </div>
            <button
              onClick={() => navigate(`/chat/${activeConversation.id}`)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'white',
                color: branding.secondaryColor,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Topics */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: branding.primaryColor }}>
            {activeConversation ? 'Topics' : `Start a ${terminology.conversation}`}
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
            {activeConversation
              ? 'End your current session to start a new one'
              : 'Click on a topic to connect with a ' + terminology.helper}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => !activeConversation && handleStartConversation(topic)}
                disabled={isStarting || !!activeConversation}
                style={{
                  padding: '12px 16px',
                  backgroundColor: activeConversation ? '#f3f4f6' : `${branding.primaryColor}10`,
                  borderLeft: `3px solid ${activeConversation ? '#9ca3af' : branding.primaryColor}`,
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderRadius: '4px',
                  textAlign: 'left',
                  cursor: activeConversation ? 'not-allowed' : 'pointer',
                  color: activeConversation ? '#9ca3af' : '#1f2937',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!activeConversation) {
                    e.currentTarget.style.backgroundColor = `${branding.primaryColor}20`;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!activeConversation) {
                    e.currentTarget.style.backgroundColor = `${branding.primaryColor}10`;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Session History and Helper Dashboard Links */}
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <Link
            to={`/community/${slug}/history`}
            style={{
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '4px',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = branding.primaryColor;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <span style={{ fontSize: '16px' }}>📋</span>
            Session History
          </Link>
          {(membership.is_available || membership.role === 'helper' || membership.role === 'both') && (
            <Link
              to={`/community/${slug}/helper-dashboard`}
              style={{
                color: '#6b7280',
                textDecoration: 'none',
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '4px',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = branding.primaryColor;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              <span style={{ fontSize: '16px' }}>📊</span>
              Helper Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
