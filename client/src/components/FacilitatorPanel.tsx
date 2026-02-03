import { useState, useEffect, useRef } from 'react';
import { FacilitatorResponse, FacilitatorMessage, getFacilitatorSuggestions } from '../services/api';

interface FacilitatorPanelProps {
  conversationId: string;
  recentMessages: FacilitatorMessage[];
  onSuggestionClick: (suggestion: string) => void;
}

export default function FacilitatorPanel({
  conversationId,
  recentMessages,
  onSuggestionClick,
}: FacilitatorPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FacilitatorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastMessageCountRef = useRef(0);
  const hasFetchedRef = useRef(false);

  const fetchSuggestions = async () => {
    if (recentMessages.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getFacilitatorSuggestions(conversationId, recentMessages);
      setSuggestions(response);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setError('Could not load suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when panel is first expanded
  useEffect(() => {
    if (isExpanded && !hasFetchedRef.current && !isLoading) {
      fetchSuggestions();
    }
  }, [isExpanded]);

  // Auto-fetch when new seeker message arrives (if panel is expanded)
  useEffect(() => {
    const seekerMessages = recentMessages.filter((m) => m.sender_role === 'seeker');
    const currentCount = seekerMessages.length;

    if (isExpanded && currentCount > lastMessageCountRef.current && hasFetchedRef.current) {
      fetchSuggestions();
    }

    lastMessageCountRef.current = currentCount;
  }, [recentMessages, isExpanded]);

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick(suggestion);
  };

  return (
    <div
      style={{
        backgroundColor: '#EDF4FF',
        borderTop: '1px solid #E2E8F0',
      }}
    >
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '10px 20px',
          backgroundColor: '#EDF4FF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🛠️</span>
          <span style={{ fontWeight: 500, color: '#1E3A5F', fontSize: '14px' }}>Helper Tools</span>
        </div>
        <span
          style={{
            color: '#64748B',
            fontSize: '12px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '16px 20px', paddingTop: '0' }}>
          {/* Loading State */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B', fontStyle: 'italic' }}>
                Getting suggestions...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <p style={{ margin: '0 0 8px', color: '#DC2626', fontSize: '14px' }}>{error}</p>
              <button
                onClick={fetchSuggestions}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'white',
                  color: '#2B7CF6',
                  border: '1px solid #2B7CF6',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#EDF4FF';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Suggestions */}
          {suggestions && !isLoading && (
            <>
              {/* Suggested Responses */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1E3A5F' }}>
                    Suggested Responses
                  </p>
                  <button
                    onClick={fetchSuggestions}
                    disabled={isLoading}
                    style={{
                      padding: '6px 16px',
                      backgroundColor: 'white',
                      color: '#2B7CF6',
                      border: '1px solid #2B7CF6',
                      borderRadius: '24px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#EDF4FF';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>↻</span>
                    Refresh
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {suggestions.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1E3A5F',
                        lineHeight: '1.4',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#2B7CF6';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Click to add to your message (you can edit before sending)
                </p>
              </div>

              {/* Tip Section */}
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  borderLeft: '3px solid #F59E0B',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>💡</span>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#1E3A5F' }}>
                      Tip
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: '1.4' }}>
                      {suggestions.tip}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Initial state before first fetch */}
          {!suggestions && !isLoading && !error && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <p style={{ margin: '0 0 8px', color: '#64748B', fontSize: '14px' }}>
                Get AI-powered suggestions to help you respond
              </p>
              <button
                onClick={fetchSuggestions}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
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
                Get Suggestions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
