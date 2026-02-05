import { useState, useEffect, useRef, FormEvent, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Conversation, ConnectionData, Message, getConversation, sendMessage, endConversation, getMembership, FacilitatorMessage } from '../services/api';
import { connectSocket, joinConversation, leaveConversation, sendTypingIndicator, getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import RatingModal from '../components/RatingModal';
import FacilitatorPanel from '../components/FacilitatorPanel';
import ReportUserModal from '../components/ReportUserModal';
import ConnectionCard from '../components/ConnectionCard';

interface SafetyAlert {
  riskLevel: 'moderate_concern' | 'crisis';
  messageId: string;
}

interface HelperJoinedEvent {
  conversationId: string;
  helperEmail: string;
  helperMembershipId: string;
  isVerifiedHelper: boolean;
}

interface ConversationEndedEvent {
  conversationId: string;
  endedBy: string;
}

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [_crisisRiskLevel, setCrisisRiskLevel] = useState<'moderate_concern' | 'crisis' | null>(null);
  const [helperJoined, setHelperJoined] = useState<string | null>(null);
  const [helperIsVerified, setHelperIsVerified] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [userRole, setUserRole] = useState<'seeker' | 'helper' | null>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [matchingElapsed, setMatchingElapsed] = useState(0);
  const [peerbotFallbackActive, setPeerbotFallbackActive] = useState(false);
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation and connect to socket
  useEffect(() => {
    if (!conversationId) return;

    async function loadConversation() {
      try {
        const data = await getConversation(conversationId!);
        setConversation(data);
        setMessages(data.messages || []);

        // Set connection data if helper has already joined
        if (data.connection_data) {
          setConnectionData(data.connection_data);
        }

        // Determine user's role in this conversation
        if (data.community_slug) {
          try {
            const membership = await getMembership(data.community_slug);
            if (membership.id === data.seeker_membership_id) {
              setUserRole('seeker');
            } else if (membership.id === data.helper_membership_id) {
              setUserRole('helper');
            } else {
              // User is neither seeker nor helper - they're viewing as admin
              setIsAdminViewer(true);
            }
          } catch (err) {
            console.error('Failed to get membership:', err);
          }
        }

        // Connect to socket and join room
        const socket = connectSocket();
        joinConversation(conversationId!);

        // Listen for new messages
        socket.on('new_message', (message: Message) => {
          if (message.conversation_id === conversationId) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === message.id)) return prev;
              return [...prev, message];
            });
          }
        });

        // Listen for typing indicators
        socket.on('user_typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
          if (data.conversationId === conversationId && data.userId !== user?.id) {
            setTypingUser(data.isTyping ? data.userId : null);
          }
        });

        // Listen for safety alerts
        socket.on('safety_alert', (alert: SafetyAlert) => {
          console.log('Safety alert received:', alert);
          setCrisisRiskLevel(alert.riskLevel);
          setShowCrisisBanner(true);
        });

        // Listen for helper joining
        socket.on('helper_joined', (event: HelperJoinedEvent) => {
          console.log('Helper joined:', event);
          setHelperJoined(event.helperEmail);
          setHelperIsVerified(event.isVerifiedHelper);
          setConversation((prev) =>
            prev ? { ...prev, status: 'active', helper_membership_id: event.helperMembershipId } : prev
          );

          // Fetch connection data now that a helper has joined
          getConversation(conversationId!).then((refreshed) => {
            if (refreshed.connection_data) {
              setConnectionData(refreshed.connection_data);
            }
          }).catch((err) => {
            console.error('Failed to fetch connection data:', err);
          });
        });

        // Listen for conversation ended (by the other user)
        socket.on('conversation_ended', (event: ConversationEndedEvent) => {
          console.log('Conversation ended:', event);
          if (event.conversationId === conversationId) {
            setConversation((prev) =>
              prev ? { ...prev, status: 'ended', ended_at: new Date().toISOString() } : prev
            );
            // Show rating modal for the user who didn't end the session
            if (event.endedBy !== user?.id) {
              setShowRatingModal(true);
            }
          }
        });

        // Listen for PeerBot fallback
        socket.on('peerbot_fallback', (event: { conversationId: string }) => {
          if (event.conversationId === conversationId) {
            setPeerbotFallbackActive(true);
          }
        });
      } catch (err) {
        setError('Failed to load conversation');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadConversation();

    return () => {
      // Cleanup on unmount
      if (conversationId) {
        leaveConversation(conversationId);
      }
      const socket = getSocket();
      socket?.off('new_message');
      socket?.off('user_typing');
      socket?.off('safety_alert');
      socket?.off('helper_joined');
      socket?.off('conversation_ended');
      socket?.off('peerbot_fallback');
    };
  }, [conversationId, user?.id]);

  // Matching elapsed timer - ticks every second while in matching state
  useEffect(() => {
    if (conversation?.status !== 'matching' || helperJoined) return;

    const updateElapsed = () => {
      const startedAt = new Date(conversation.started_at).getTime();
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setMatchingElapsed(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [conversation?.status, conversation?.started_at, helperJoined]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(conversationId, newMessage.trim());
      setNewMessage('');
      sendTypingIndicator(conversationId, false);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);

    if (!conversationId) return;

    // Send typing indicator
    sendTypingIndicator(conversationId, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(conversationId, false);
    }, 2000);
  };

  const handleEndSession = async () => {
    if (!conversationId || isEnding) return;

    if (!confirm('Are you sure you want to end this session?')) return;

    setIsEnding(true);
    try {
      const endedConversation = await endConversation(conversationId);
      setConversation(endedConversation);
      setShowRatingModal(true);
    } catch (err) {
      console.error('Failed to end conversation:', err);
      setIsEnding(false);
    }
  };

  const handleRatingClose = () => {
    setShowRatingModal(false);
    navigate(`/community/${conversation?.community_slug}`);
  };

  const handleRatingSubmitted = () => {
    setShowRatingModal(false);
    navigate(`/community/${conversation?.community_slug}`);
  };

  const handleDismissCrisisBanner = () => {
    setShowCrisisBanner(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewMessage(suggestion);
  };

  // Prepare recent messages for facilitator (last 6 messages)
  const recentMessagesForFacilitator: FacilitatorMessage[] = useMemo(() => {
    return messages.slice(-6).map((msg) => {
      const isPeerBot = msg.moderation_result?.sender === 'peerbot';
      const isMine = !isPeerBot && msg.sender_email === user?.email;

      let sender_role: 'seeker' | 'helper' | 'peerbot';
      if (isPeerBot) {
        sender_role = 'peerbot';
      } else if (userRole === 'helper') {
        sender_role = isMine ? 'helper' : 'seeker';
      } else {
        sender_role = isMine ? 'seeker' : 'helper';
      }

      return {
        content: msg.content,
        sender_role,
      };
    });
  }, [messages, user?.email, userRole]);

  // Should show facilitator panel for helpers in active conversations
  const showFacilitator = userRole === 'helper' && conversation?.status === 'active';

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
        <p style={{ color: '#64748B' }}>Loading conversation...</p>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div style={{ padding: '20px' }}>
        <p style={{ color: '#DC2626' }}>{error || 'Conversation not found'}</p>
        <Link to="/communities" style={{ color: '#2B7CF6' }}>
          Back to Communities
        </Link>
      </div>
    );
  }

  const isMatching = conversation.status === 'matching';
  const isEnded = conversation.status === 'ended';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header
        style={{
          padding: '16px 20px',
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1E3A5F' }}>
            {conversation.topic || 'Support Session'}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
            {conversation.community_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            to={`/community/${conversation.community_slug}`}
            style={{
              color: '#64748B',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              padding: '8px 16px',
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
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
            Back
          </Link>
          {!isAdminViewer && !reportSubmitted && (
            <button
              onClick={() => setShowReportModal(true)}
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
                e.currentTarget.style.borderColor = '#DC2626';
                e.currentTarget.style.color = '#DC2626';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.color = '#64748B';
              }}
            >
              Report
            </button>
          )}
          {reportSubmitted && (
            <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 500, padding: '8px 0' }}>
              Report submitted
            </span>
          )}
          {!isEnded && !isAdminViewer && (
            <button
              onClick={handleEndSession}
              disabled={isEnding}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#DC2626',
                border: '1px solid #DC2626',
                borderRadius: '24px',
                cursor: isEnding ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                opacity: isEnding ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (!isEnding) {
                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              {isEnding ? 'Ending...' : 'End Session'}
            </button>
          )}
        </div>
      </header>

      {/* Admin Viewer Banner */}
      {isAdminViewer && (
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#FEF3C7',
            color: '#92400E',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Viewing as Admin - You are not a participant in this conversation
        </div>
      )}

      {/* Crisis Resources Banner */}
      {showCrisisBanner && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#DC2626',
            color: 'white',
            borderRadius: '0 0 16px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>If you're in crisis, help is available</span>
              </p>
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                <p style={{ margin: '4px 0' }}>
                  <strong>988 Suicide & Crisis Lifeline</strong> - Call or text 988
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Crisis Text Line</strong> - Text HOME to 741741
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Emergency</strong> - Call 911
                </p>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: '13px', opacity: 0.9 }}>
                You don't have to face this alone. Professional help is available 24/7.
              </p>
            </div>
            <button
              onClick={handleDismissCrisisBanner}
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                marginLeft: '16px',
              }}
            >
              I'm okay
            </button>
          </div>
        </div>
      )}

      {/* Helper Joined Banner */}
      {helperJoined && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: helperIsVerified ? '#ECFDF5' : '#EDF4FF',
            color: '#1E3A5F',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#16A34A',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
          {peerbotFallbackActive ? (
            <>
              A <strong>Peer Supporter</strong> has joined
              {helperIsVerified && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#16A34A',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginLeft: '4px',
                  }}
                >
                  Verified
                </span>
              )}
            </>
          ) : helperIsVerified ? (
            <>
              Connected with a{' '}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#16A34A',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                Verified Peer Supporter
              </span>
            </>
          ) : (
            <>
              Connected with a <strong>Peer Supporter</strong>
            </>
          )}
        </div>
      )}

      {/* Matching Status Banner - progressive messages */}
      {isMatching && !helperJoined && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: peerbotFallbackActive ? '#ECFDF5' : '#EDF4FF',
            color: '#1E3A5F',
            textAlign: 'center',
          }}
        >
          {peerbotFallbackActive || matchingElapsed >= 90
            ? 'Connecting you with PeerBot while we keep searching...'
            : matchingElapsed >= 60
            ? 'Looking for any available helper...'
            : matchingElapsed >= 30
            ? 'Expanding search...'
            : 'Finding your best match...'}
        </div>
      )}

      {/* Ended Status Banner */}
      {isEnded && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#EDF4FF',
            color: '#1E3A5F',
            textAlign: 'center',
          }}
        >
          This session has ended.
        </div>
      )}

      {/* Connection Card - shown once helper has joined */}
      {connectionData && userRole && !isAdminViewer && (
        <ConnectionCard
          connectionData={connectionData}
          userRole={userRole}
        />
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#F8FAFC',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748B' }}>
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((message) => {
            const isPeerBot = message.moderation_result?.sender === 'peerbot';
            const isMine = !isPeerBot && !isAdminViewer && message.sender_email === user?.email;

            // Determine the sender's role based on membership ID
            const isFromSeeker = message.sender_membership_id === conversation?.seeker_membership_id;
            const isFromHelper = message.sender_membership_id === conversation?.helper_membership_id;

            // For admin viewers, determine message styling based on role
            const getSenderLabel = () => {
              if (isPeerBot) return 'PeerBot';
              if (isAdminViewer) {
                const role = isFromSeeker ? 'Seeker' : isFromHelper ? 'Helper' : 'Unknown';
                return `${role}: ${message.sender_email || 'Anonymous'}`;
              }
              // Show friendly label instead of email for privacy
              if (userRole === 'seeker') {
                return isFromHelper ? 'Peer Supporter' : 'Anonymous';
              } else {
                return isFromSeeker ? 'Your Peer' : 'Anonymous';
              }
            };

            // Background colors based on design system
            const getBackgroundColor = () => {
              if (isMine) return '#7C5CFC'; // Helper bubble (purple) for own messages
              if (isPeerBot) return '#F0F0F0'; // PeerBot gray
              if (isAdminViewer) {
                if (isFromSeeker) return '#DCE9FF'; // Seeker light blue
                if (isFromHelper) return '#7C5CFC'; // Helper purple
              }
              return '#DCE9FF'; // Seeker bubble (light blue) for others
            };

            // Text color
            const getTextColor = () => {
              if (isMine) return 'white';
              if (isPeerBot) return '#1E3A5F';
              if (isAdminViewer && isFromHelper) return 'white';
              return '#1E3A5F';
            };

            // Label colors based on role
            const getLabelColor = () => {
              if (isPeerBot) return '#64748B';
              if (isAdminViewer) {
                if (isFromSeeker) return '#2B7CF6';
                if (isFromHelper) return '#7C5CFC';
              }
              return '#64748B';
            };

            return (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  marginBottom: '12px',
                }}
              >
                {isPeerBot && (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                    }}
                  >
                    <img
                      src="/peerbot-avatar.png"
                      alt="PeerBot"
                      style={{
                        width: '28px',
                        height: '28px',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  {!isMine && (
                    <p
                      style={{
                        margin: '0 0 4px 4px',
                        fontSize: '12px',
                        color: getLabelColor(),
                        fontWeight: isPeerBot || isAdminViewer ? 600 : 400,
                      }}
                    >
                      {getSenderLabel()}
                    </p>
                  )}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '20px',
                      backgroundColor: getBackgroundColor(),
                      color: getTextColor(),
                    }}
                  >
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: '10px',
                        opacity: 0.7,
                        textAlign: 'right',
                      }}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#DCE9FF',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#64748B',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#64748B',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s infinite 0.3s',
                }}
              />
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#64748B',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s infinite 0.6s',
                }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Facilitator Panel - only for helpers in active conversations */}
      {showFacilitator && conversationId && (
        <FacilitatorPanel
          conversationId={conversationId}
          recentMessages={recentMessagesForFacilitator}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      {/* Message Input - only for active conversations and non-admin viewers */}
      {!isEnded && !isAdminViewer ? (
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '16px 20px',
            backgroundColor: 'white',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: '12px',
          }}
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: '14px 20px',
              border: '1px solid #E2E8F0',
              borderRadius: '24px',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#2B7CF6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#E2E8F0';
            }}
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            style={{
              padding: '14px 28px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              cursor: isSending || !newMessage.trim() ? 'not-allowed' : 'pointer',
              opacity: isSending || !newMessage.trim() ? 0.5 : 1,
              fontSize: '16px',
              fontWeight: 600,
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isSending && newMessage.trim()) {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2B7CF6';
            }}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      ) : (
        /* Read-only footer for ended conversations or admin viewers */
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#EDF4FF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
            {isAdminViewer
              ? 'Viewing as admin (read-only)'
              : `This session ended ${
                  conversation?.ended_at
                    ? new Date(conversation.ended_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : ''
                }`}
          </p>
          <Link
            to={isAdminViewer ? `/community/${conversation?.community_slug}/admin` : `/community/${conversation?.community_slug}/history`}
            style={{
              color: '#2B7CF6',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {isAdminViewer ? 'Back to Admin Dashboard' : 'Back to History'}
          </Link>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && conversationId && userRole && (
        <RatingModal
          conversationId={conversationId}
          role={userRole}
          onClose={handleRatingClose}
          onSubmitted={handleRatingSubmitted}
        />
      )}

      {/* Report User Modal */}
      {showReportModal && conversationId && (
        <ReportUserModal
          conversationId={conversationId}
          onClose={() => setShowReportModal(false)}
          onSubmitted={() => {
            setShowReportModal(false);
            setReportSubmitted(true);
          }}
        />
      )}
    </div>
  );
}
