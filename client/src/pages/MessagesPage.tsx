import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Community,
  Membership,
  Conversation,
  HistoryConversation,
  PendingConversation,
  getCommunity,
  getMembership,
  getActiveConversations,
  getSessionHistory,
  getPendingConversations,
  acceptConversation,
} from '../services/api';
import { AxiosError } from 'axios';

const MOOD_EMOJIS: Record<number, string> = {
  1: '\uD83D\uDE2B',
  2: '\uD83D\uDE1F',
  3: '\uD83D\uDE10',
  4: '\uD83D\uDE42',
  5: '\uD83D\uDE0A',
};

export default function MessagesPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [activeConversations, setActiveConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<PendingConversation[]>([]);
  const [pastConversations, setPastConversations] = useState<HistoryConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAccepting, setIsAccepting] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, membershipData, activeConvs, historyData] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
          getActiveConversations(),
          getSessionHistory(slug),
        ]);

        setCommunity(communityData);
        setMembership(membershipData);

        // Filter active conversations to this community only
        const communityActiveConvs = activeConvs.filter(
          (c) => c.community_id === communityData.id
        );
        setActiveConversations(communityActiveConvs);
        setPastConversations(historyData);

        // Load pending conversations if user is a helper
        const isHelper =
          membershipData.role === 'helper' ||
          membershipData.role === 'both' ||
          membershipData.role === 'admin';

        if (isHelper) {
          const pending = await getPendingConversations();
          setPendingConversations(
            pending.filter((p) => p.community_id === communityData.id)
          );
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        setError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const handleAcceptConversation = async (conversationId: string) => {
    if (isAccepting) return;

    setIsAccepting(conversationId);
    try {
      await acceptConversation(conversationId);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      alert(axiosError.response?.data?.error || 'Failed to accept conversation');
      // Refresh pending list
      if (community) {
        const pending = await getPendingConversations();
        setPendingConversations(
          pending.filter((p) => p.community_id === community.id)
        );
      }
    } finally {
      setIsAccepting(null);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return '';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Less than a minute';
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const truncateMessage = (message: string | null | undefined, maxLength = 50) => {
    if (!message) return '';
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength).trim() + '...';
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
      </div>
    );
  }

  const isHelper =
    membership.role === 'helper' ||
    membership.role === 'both' ||
    membership.role === 'admin';

  const hasActiveContent =
    activeConversations.length > 0 || pendingConversations.length > 0;

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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/peerzle-icon.svg"
              alt="Peerzle"
              style={{ width: '32px', height: '32px' }}
            />
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#1E3A5F',
                }}
              >
                Messages
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                {community.name}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-tabs */}
      <div
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '12px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: `1px solid ${activeTab === 'active' ? '#2B7CF6' : '#E2E8F0'}`,
              backgroundColor: activeTab === 'active' ? '#EDF4FF' : 'white',
              color: activeTab === 'active' ? '#2B7CF6' : '#64748B',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Active
            {hasActiveContent && activeTab !== 'active' && (
              <span
                style={{
                  marginLeft: '6px',
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#2B7CF6',
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: `1px solid ${activeTab === 'past' ? '#2B7CF6' : '#E2E8F0'}`,
              backgroundColor: activeTab === 'past' ? '#EDF4FF' : 'white',
              color: activeTab === 'past' ? '#2B7CF6' : '#64748B',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Past
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px 20px' }}>
        {activeTab === 'active' ? (
          <>
            {/* Pending Requests (helpers only) */}
            {isHelper && pendingConversations.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Pending Requests
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingConversations.map((conv) => {
                    const score = conv.match_score;
                    const scoreColor =
                      score != null && score >= 80
                        ? '#16A34A'
                        : score != null && score >= 60
                        ? '#D97706'
                        : '#94A3B8';

                    return (
                      <div
                        key={conv.id}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          padding: '16px',
                          borderLeft: '4px solid #2B7CF6',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                  color: '#1E3A5F',
                                  fontSize: '15px',
                                }}
                              >
                                {conv.topic || 'General Support'}
                              </p>
                              {score != null && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: 'white',
                                    backgroundColor: scoreColor,
                                  }}
                                >
                                  {score}% match
                                </span>
                              )}
                              {conv.same_org && (
                                <span
                                  style={{
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
                              )}
                            </div>
                            <p
                              style={{
                                margin: '4px 0 0',
                                fontSize: '13px',
                                color: '#64748B',
                              }}
                            >
                              Waiting {formatRelativeTime(conv.started_at)}
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
                              cursor:
                                isAccepting === conv.id ? 'not-allowed' : 'pointer',
                              fontWeight: 500,
                              fontSize: '14px',
                              opacity: isAccepting === conv.id ? 0.6 : 1,
                              transition: 'background-color 0.2s',
                            }}
                          >
                            {isAccepting === conv.id ? 'Accepting...' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Conversations */}
            {activeConversations.length > 0 ? (
              <div>
                {isHelper && pendingConversations.length > 0 && (
                  <h3
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Your Conversations
                  </h3>
                )}
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  {activeConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.boxShadow =
                          '0 4px 12px rgba(0,0,0,0.12)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.boxShadow =
                          '0 1px 3px rgba(0,0,0,0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 600,
                                color: '#1E3A5F',
                                fontSize: '15px',
                              }}
                            >
                              {conv.peer_display_name || 'Waiting for match...'}
                            </p>
                            {conv.status === 'matching' && (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  color: '#D97706',
                                  backgroundColor: '#FEF3C7',
                                }}
                              >
                                Matching
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: '4px 0 0',
                              fontSize: '13px',
                              color: '#64748B',
                            }}
                          >
                            {conv.topic || 'General Support'}
                          </p>
                          {conv.last_message && (
                            <p
                              style={{
                                margin: '6px 0 0',
                                fontSize: '14px',
                                color: '#475569',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              "{truncateMessage(conv.last_message)}"
                            </p>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#94A3B8',
                            whiteSpace: 'nowrap',
                            marginLeft: '12px',
                          }}
                        >
                          {formatRelativeTime(
                            conv.last_message_at || conv.started_at
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              !hasActiveContent && (
                <div
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '48px 24px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                  <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>
                    No active conversations
                  </h2>
                  <p style={{ margin: 0, color: '#64748B' }}>
                    Start a new conversation from the Home tab
                  </p>
                </div>
              )
            )}
          </>
        ) : (
          /* Past Tab */
          <>
            {pastConversations.length === 0 ? (
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
                <h2 style={{ margin: '0 0 8px 0', color: '#1E3A5F' }}>
                  No past conversations
                </h2>
                <p style={{ margin: 0, color: '#64748B' }}>
                  Your completed sessions will appear here
                </p>
              </div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {pastConversations.map((session) => {
                  const moodChange =
                    session.seeker_pre_mood != null &&
                    session.seeker_post_mood != null
                      ? session.seeker_post_mood - session.seeker_pre_mood
                      : null;

                  return (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/chat/${session.id}`)}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s, transform 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.boxShadow =
                          '0 4px 12px rgba(0,0,0,0.12)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.boxShadow =
                          '0 1px 3px rgba(0,0,0,0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 600,
                                color: '#1E3A5F',
                                fontSize: '15px',
                              }}
                            >
                              {session.other_user_display_name ||
                                (session.role === 'seeker'
                                  ? 'PeerBot'
                                  : 'Anonymous Peer')}
                            </p>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 500,
                                backgroundColor:
                                  session.role === 'seeker'
                                    ? '#DCE9FF'
                                    : '#E9E0FF',
                                color:
                                  session.role === 'seeker'
                                    ? '#1E3A5F'
                                    : '#7C5CFC',
                              }}
                            >
                              {session.role === 'seeker' ? 'Seeker' : 'Helper'}
                            </span>
                          </div>
                          <p
                            style={{
                              margin: '4px 0 0',
                              fontSize: '13px',
                              color: '#64748B',
                            }}
                          >
                            {session.topic || 'General Support'}
                          </p>
                          <p
                            style={{
                              margin: '4px 0 0',
                              fontSize: '12px',
                              color: '#94A3B8',
                            }}
                          >
                            {formatDate(session.ended_at || session.started_at)}
                            {session.ended_at && (
                              <span>
                                {' '}
                                · {formatDuration(session.started_at, session.ended_at)}
                              </span>
                            )}
                          </p>
                          {/* Mood change indicator */}
                          {session.seeker_pre_mood != null &&
                            session.seeker_post_mood != null && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  marginTop: '8px',
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>
                                  {MOOD_EMOJIS[session.seeker_pre_mood]} →{' '}
                                  {MOOD_EMOJIS[session.seeker_post_mood]}
                                </span>
                                {moodChange != null && moodChange !== 0 && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color:
                                        moodChange > 0 ? '#16A34A' : '#DC2626',
                                    }}
                                  >
                                    {moodChange > 0 ? '+' : ''}
                                    {moodChange}
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                        {/* Rating stars */}
                        {session.rating && (
                          <div style={{ marginLeft: '12px' }}>
                            <span style={{ fontSize: '14px', color: '#F59E0B' }}>
                              {'★'.repeat(session.rating)}
                              <span style={{ color: '#D1D5DB' }}>
                                {'★'.repeat(5 - session.rating)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
