import { useState, useEffect, useRef, FormEvent, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Conversation, ConnectionData, Message, getConversation, sendMessage, endConversation, getMembership, SuggestionsMessage, startPeerBotEarly } from '../services/api';
import { connectSocket, joinConversation, leaveConversation, sendTypingIndicator, getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import RatingModal from '../components/RatingModal';
import PostChatModal from '../components/PostChatModal';
import MoodCheckModal from '../components/MoodCheckModal';
import SuggestionsPanel from '../components/SuggestionsPanel';
import ReportUserModal from '../components/ReportUserModal';
import ConnectionCard from '../components/ConnectionCard';

// Motivational quotes for the waiting screen carousel
const MOTIVATIONAL_QUOTES = [
  "You don't have to go through this alone.",
  "Asking for support is a sign of strength, not weakness.",
  "Every conversation is a step forward.",
  "It's okay to not be okay.",
  "Your feelings are valid, and they matter.",
  "Healing doesn't happen in isolation — it happens in connection.",
  "The bravest thing you can do is let someone in.",
  "You've survived 100% of your hardest days.",
  "Vulnerability is not winning or losing; it's having the courage to show up. — Brené Brown",
  "There is no greater agony than bearing an untold story inside you. — Maya Angelou",
  "One conversation can change everything.",
  "You are not your worst moment.",
];

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
  const [helperJoined, setHelperJoined] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [helperIsVerified, setHelperIsVerified] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showWhatsNext, setShowWhatsNext] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [userRole, setUserRole] = useState<'seeker' | 'helper' | null>(null);
  const [isAdminViewer, setIsAdminViewer] = useState(false);
  const [matchingElapsed, setMatchingElapsed] = useState(0);
  const [peerbotFallbackActive, setPeerbotFallbackActive] = useState(false);
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const [quoteVisible, setQuoteVisible] = useState(true);
  const [isStartingPeerBot, setIsStartingPeerBot] = useState(false);
  const [showMoodCheck, setShowMoodCheck] = useState(false);
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
              // Show mood check for seekers who haven't set pre_mood yet and conversation is not ended
              if (data.seeker_pre_mood == null && data.status !== 'ended') {
                setShowMoodCheck(true);
              }
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
          try {
            if (message.conversation_id === conversationId) {
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
              });
            }
          } catch (err) {
            console.error('Error handling new message:', err);
          }
        });

        // Listen for typing indicators
        socket.on('user_typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
          try {
            if (data.conversationId === conversationId && data.userId !== user?.id) {
              setTypingUser(data.isTyping ? data.userId : null);
            }
          } catch (err) {
            console.error('Error handling typing indicator:', err);
          }
        });

        // Listen for safety alerts
        socket.on('safety_alert', (alert: SafetyAlert) => {
          try {
            console.log('Safety alert received:', alert);
            if (alert.riskLevel === 'crisis' || alert.riskLevel === 'moderate_concern') {
              setShowCrisisBanner(true);
            }
          } catch (err) {
            console.error('Error handling safety alert:', err);
          }
        });

        // Listen for helper joining
        socket.on('helper_joined', (event: HelperJoinedEvent) => {
          try {
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
          } catch (err) {
            console.error('Error handling helper joined:', err);
          }
        });

        // Listen for conversation ended (by the other user)
        socket.on('conversation_ended', (event: ConversationEndedEvent) => {
          try {
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
          } catch (err) {
            console.error('Error handling conversation ended:', err);
          }
        });

        // Listen for matching failed
        socket.on('matching_failed', (event: { conversationId: string; error: string }) => {
          try {
            if (event.conversationId === conversationId) {
              setConversation((prev) =>
                prev ? { ...prev, status: 'ended', ended_at: new Date().toISOString() } : prev
              );
              setError(event.error || 'Unable to find a helper at this time. Please try again later.');
            }
          } catch (err) {
            console.error('Error handling matching failed:', err);
          }
        });

        // Listen for PeerBot fallback
        socket.on('peerbot_fallback', (event: { conversationId: string }) => {
          try {
            if (event.conversationId === conversationId) {
              setPeerbotFallbackActive(true);
            }
          } catch (err) {
            console.error('Error handling PeerBot fallback:', err);
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

  // Quotes carousel rotation - every 7 seconds with fade animation
  useEffect(() => {
    if (conversation?.status !== 'matching' || helperJoined || peerbotFallbackActive) return;

    const rotateQuote = () => {
      setQuoteVisible(false);
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
        setQuoteVisible(true);
      }, 500); // Half second fade out, then change quote and fade in
    };

    const interval = setInterval(rotateQuote, 7000);
    return () => clearInterval(interval);
  }, [conversation?.status, helperJoined, peerbotFallbackActive]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!conversationId || !newMessage.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      await sendMessage(conversationId, newMessage.trim());
      setNewMessage('');
      sendTypingIndicator(conversationId, false);
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError('Failed to send message. Please try again.');
      // Auto-clear error after 5 seconds
      setTimeout(() => setSendError(null), 5000);
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

  const handleEndSessionClick = () => {
    if (!conversationId || isEnding) return;
    setShowEndSessionModal(true);
  };

  const handleConfirmEndSession = async () => {
    if (!conversationId || isEnding) return;

    setShowEndSessionModal(false);
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
    // For seekers, show "what's next" prompt; for helpers, go to dashboard
    if (userRole === 'seeker') {
      setShowWhatsNext(true);
    } else {
      navigate(`/community/${conversation?.community_slug}`);
    }
  };

  const handleRatingSubmitted = () => {
    setShowRatingModal(false);
    // For seekers, show "what's next" prompt; for helpers, go to dashboard
    if (userRole === 'seeker') {
      setShowWhatsNext(true);
    } else {
      navigate(`/community/${conversation?.community_slug}`);
    }
  };

  const handleDismissCrisisBanner = () => {
    setShowCrisisBanner(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewMessage(suggestion);
  };

  const handleStartPeerBotEarly = useCallback(async () => {
    if (!conversationId || isStartingPeerBot) return;

    setIsStartingPeerBot(true);
    try {
      await startPeerBotEarly(conversationId);
      // The peerbot_fallback socket event will trigger setPeerbotFallbackActive(true)
    } catch (err) {
      console.error('Failed to start PeerBot early:', err);
      setIsStartingPeerBot(false);
    }
  }, [conversationId, isStartingPeerBot]);

  // Prepare recent messages for suggestions panel (last 10 messages)
  const recentMessagesForSuggestions: SuggestionsMessage[] = useMemo(() => {
    return messages.slice(-10).map((msg) => {
      const isPeerBot = msg.moderation_result?.sender === 'peerbot';
      const isMine = !isPeerBot && msg.sender_email === user?.email;

      let role: 'seeker' | 'helper' | 'peerbot';
      if (isPeerBot) {
        role = 'peerbot';
      } else if (userRole === 'helper') {
        role = isMine ? 'helper' : 'seeker';
      } else {
        role = isMine ? 'seeker' : 'helper';
      }

      return {
        content: msg.content,
        role,
      };
    });
  }, [messages, user?.email, userRole]);

  // Should show suggestions panel for helpers and seekers in active conversations
  const showSuggestions = (userRole === 'helper' || userRole === 'seeker') && conversation?.status === 'active';

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

  // PeerBot intro message - shown once at the start of active conversations
  const peerbotIntroMessage = `Welcome to your conversation! 👋 Here are a few things to know:

• This is a safe, anonymous space. Neither of you can see the other's identity.
• Use the suggested responses panel if you're unsure what to say — they're written by licensed counselors.
• You can end the conversation at any time using the menu.
• If either of you needs immediate crisis support, resources are always available.

Take your time, be yourself, and remember — you're not alone.`;

  // Only show intro if conversation is active and there are no regular messages yet (fresh start)
  const showPeerbotIntro = (conversation.status === 'active' || helperJoined) && messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header - single row: [← Back + Topic] ... [Report + End] */}
      <header
        style={{
          padding: '8px 12px',
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '56px',
        }}
      >
        {/* Left group: Back + Topic/Community */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <Link
            to={`/community/${conversation.community_slug}`}
            style={{
              color: '#64748B',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              padding: '8px 4px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ← Back
          </Link>
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 600,
                color: '#1E3A5F',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {conversation.topic || 'Support Session'}
            </h2>
            <p
              style={{
                margin: '1px 0 0',
                fontSize: '11px',
                color: '#94A3B8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {conversation.community_name}
            </p>
          </div>
        </div>

        {/* Right group: Action buttons */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {!isAdminViewer && !reportSubmitted && (
            <button
              onClick={() => setShowReportModal(true)}
              style={{
                padding: '6px 10px',
                backgroundColor: 'white',
                color: '#64748B',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
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
            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 500, padding: '6px 0' }}>
              Reported
            </span>
          )}
          {!isEnded && !isAdminViewer && (
            <button
              onClick={handleEndSessionClick}
              disabled={isEnding}
              style={{
                padding: '6px 10px',
                backgroundColor: 'white',
                color: '#EF4444',
                border: '1px solid #FCA5A5',
                borderRadius: '16px',
                cursor: isEnding ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                opacity: isEnding ? 0.7 : 1,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
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
              {isEnding ? '...' : 'End'}
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
              Great news! A <strong>Peer Supporter</strong> has joined your conversation
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

      {/* Enhanced Matching/Waiting Screen */}
      {isMatching && !helperJoined && (
        <div
          style={{
            padding: '24px 20px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          {/* Progress indicator with pulsing animation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: peerbotFallbackActive ? '#16A34A' : '#2B7CF6',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#1E3A5F',
              }}
            >
              {peerbotFallbackActive
                ? 'Connected with PeerBot'
                : matchingElapsed >= 60
                ? 'Looking for any available helper...'
                : matchingElapsed >= 30
                ? 'Expanding search...'
                : 'Finding your best match...'}
            </span>
          </div>

          {/* Wait context - only show if not yet connected to PeerBot */}
          {!peerbotFallbackActive && (
            <p
              style={{
                textAlign: 'center',
                fontSize: '13px',
                color: '#64748B',
                margin: '0 0 20px 0',
              }}
            >
              Most matches happen within 30 seconds
            </p>
          )}

          {/* PeerBot early chat prompt - only show if not yet using PeerBot */}
          {!peerbotFallbackActive && (
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#F0FDF4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
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
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '14px',
                      color: '#1E3A5F',
                      lineHeight: '1.5',
                    }}
                  >
                    While we find your best match, PeerBot is here if you'd like to start talking.
                    Your conversation will transfer seamlessly when a peer joins.
                  </p>
                  <button
                    onClick={handleStartPeerBotEarly}
                    disabled={isStartingPeerBot}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '24px',
                      cursor: isStartingPeerBot ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      opacity: isStartingPeerBot ? 0.7 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (!isStartingPeerBot) {
                        e.currentTarget.style.backgroundColor = '#15803D';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#16A34A';
                    }}
                  >
                    {isStartingPeerBot ? 'Starting...' : 'Chat with PeerBot'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Motivational quotes carousel - only show if not using PeerBot */}
          {!peerbotFallbackActive && (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 20px',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontStyle: 'italic',
                  color: '#475569',
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  opacity: quoteVisible ? 1 : 0,
                  transition: 'opacity 0.5s ease-in-out',
                }}
              >
                "{MOTIVATIONAL_QUOTES[currentQuoteIndex]}"
              </p>
            </div>
          )}

          {/* PeerBot connected message - show when PeerBot is active but still matching */}
          {peerbotFallbackActive && (
            <p
              style={{
                textAlign: 'center',
                fontSize: '13px',
                color: '#16A34A',
                margin: '0',
              }}
            >
              We're still searching for a peer supporter to join you
            </p>
          )}
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
        {/* PeerBot Intro Message */}
        {showPeerbotIntro && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                backgroundColor: '#F0FDF4',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #BBF7D0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src="/peerbot-avatar.png"
                    alt="PeerBot"
                    style={{
                      width: '24px',
                      height: '24px',
                      objectFit: 'contain',
                    }}
                  />
                </div>
                <span style={{ fontWeight: 600, color: '#16A34A', fontSize: '14px' }}>PeerBot</span>
              </div>
              <p style={{ margin: 0, color: '#1E3A5F', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '14px' }}>
                {peerbotIntroMessage}
              </p>
            </div>
          </div>
        )}

        {messages.length === 0 && !showPeerbotIntro ? (
          <p style={{ textAlign: 'center', color: '#64748B' }}>
            No messages yet. Start the conversation!
          </p>
        ) : messages.length > 0 ? (
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
        ) : null}

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

      {/* Suggestions Panel - for helpers and seekers in active conversations */}
      {showSuggestions && conversationId && userRole && (
        <SuggestionsPanel
          conversationId={conversationId}
          recentMessages={recentMessagesForSuggestions}
          mode={userRole}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      {/* Send Error Message */}
      {sendError && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            textAlign: 'center',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>{sendError}</span>
          <button
            onClick={() => setSendError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
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

      {/* Mood Check Modal - shown to seekers before conversation */}
      {showMoodCheck && conversationId && userRole === 'seeker' && (
        <MoodCheckModal
          conversationId={conversationId}
          onComplete={() => {
            setShowMoodCheck(false);
            // Re-fetch conversation to get updated pre_mood
            getConversation(conversationId).then((refreshed) => {
              setConversation(refreshed);
            }).catch(() => {});
          }}
        />
      )}

      {/* Post-Chat Modal - multi-step for seekers */}
      {showRatingModal && conversationId && userRole === 'seeker' && (
        <PostChatModal
          conversationId={conversationId}
          preMood={conversation?.seeker_pre_mood ?? null}
          helperDisplayName={connectionData?.helper_display_name ?? null}
          onClose={handleRatingClose}
          onComplete={handleRatingSubmitted}
        />
      )}

      {/* Rating Modal - for helpers */}
      {showRatingModal && conversationId && userRole === 'helper' && (
        <RatingModal
          conversationId={conversationId}
          role="helper"
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

      {/* What's Next Card - shown to seekers after post-chat modal */}
      {showWhatsNext && conversation?.community_slug && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌟</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 600, color: '#1E3A5F' }}>
              What's next?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B' }}>
              Thank you for sharing. Your wellbeing matters.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => navigate(`/community/${conversation.community_slug}`)}
                style={{
                  padding: '14px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E6AD9';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2B7CF6';
                }}
              >
                Start another conversation
              </button>

              <button
                onClick={() => navigate(`/community/${conversation.community_slug}/history`)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#2B7CF6',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#2B7CF6';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
              >
                View session history
              </button>

              <button
                onClick={() => navigate(`/community/${conversation.community_slug}`)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Return to dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {showEndSessionModal && (
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
            if (e.target === e.currentTarget) setShowEndSessionModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              textAlign: 'center',
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              End this conversation?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B', lineHeight: 1.5 }}>
              Are you sure you want to end this session? You'll be asked to provide feedback afterward.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowEndSessionModal(false)}
                style={{
                  padding: '12px 24px',
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
                  e.currentTarget.style.borderColor = '#94A3B8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSession}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
