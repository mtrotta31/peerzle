import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Conversation, Message, getConversation, sendMessage, endConversation } from '../services/api';
import { connectSocket, joinConversation, leaveConversation, sendTypingIndicator, getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

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
    };
  }, [conversationId, user?.id]);

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
      await endConversation(conversationId);
      navigate(`/community/${conversation?.community_slug}`);
    } catch (err) {
      console.error('Failed to end conversation:', err);
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading conversation...</div>;
  }

  if (error || !conversation) {
    return (
      <div style={{ padding: '20px' }}>
        <p style={{ color: 'red' }}>{error || 'Conversation not found'}</p>
        <Link to="/communities">Back to Communities</Link>
      </div>
    );
  }

  const isMatching = conversation.status === 'matching';
  const isEnded = conversation.status === 'ended';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#1a365d',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{conversation.topic || 'Support Session'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>
            {conversation.community_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            to={`/community/${conversation.community_slug}`}
            style={{ color: 'white', textDecoration: 'none', fontSize: '14px' }}
          >
            Back
          </Link>
          {!isEnded && (
            <button
              onClick={handleEndSession}
              disabled={isEnding}
              style={{
                padding: '8px 16px',
                backgroundColor: '#c53030',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isEnding ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {isEnding ? 'Ending...' : 'End Session'}
            </button>
          )}
        </div>
      </div>

      {/* Matching Status Banner */}
      {isMatching && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#fef3c7',
            color: '#92400e',
            textAlign: 'center',
          }}
        >
          Waiting for a Peer Support Specialist to join...
        </div>
      )}

      {/* Ended Status Banner */}
      {isEnded && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            textAlign: 'center',
          }}
        >
          This session has ended.
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#f9fafb',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((message) => {
            const isPeerBot = message.moderation_result?.sender === 'peerbot';
            const isMine = !isPeerBot && message.sender_email === user?.email;
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
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: 'white', fontSize: '14px' }}>🤖</span>
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    backgroundColor: isMine ? '#1a365d' : isPeerBot ? '#f3e8ff' : 'white',
                    color: isMine ? 'white' : '#1f2937',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    border: isPeerBot ? '1px solid #c4b5fd' : 'none',
                  }}
                >
                  {!isMine && (
                    <p
                      style={{
                        margin: '0 0 4px',
                        fontSize: '12px',
                        color: isPeerBot ? '#7c3aed' : '#6b7280',
                        fontWeight: isPeerBot ? 600 : 400,
                      }}
                    >
                      {isPeerBot ? 'PeerBot' : message.sender_email}
                    </p>
                  )}
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: '10px',
                      opacity: 0.7,
                      textAlign: 'right',
                    }}
                  >
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
            Someone is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {!isEnded && (
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '16px 20px',
            backgroundColor: 'white',
            borderTop: '1px solid #e5e7eb',
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
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#1a365d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSending || !newMessage.trim() ? 'not-allowed' : 'pointer',
              opacity: isSending || !newMessage.trim() ? 0.5 : 1,
              fontSize: '16px',
            }}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
}
