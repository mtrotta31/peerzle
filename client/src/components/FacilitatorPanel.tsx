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
        backgroundColor: '#f0f9ff',
        borderTop: '1px solid #bae6fd',
      }}
    >
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '10px 20px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🛠️</span>
          <span style={{ fontWeight: 500, color: '#0369a1', fontSize: '14px' }}>Helper Tools</span>
        </div>
        <span
          style={{
            color: '#0369a1',
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
        <div style={{ padding: '0 20px 16px' }}>
          {/* Loading State */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#0369a1' }}>
              <p style={{ margin: 0, fontSize: '14px' }}>Getting suggestions...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <p style={{ margin: '0 0 8px', color: '#dc2626', fontSize: '14px' }}>{error}</p>
              <button
                onClick={fetchSuggestions}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#0369a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
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
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#0c4a6e' }}>
                    Suggested Responses
                  </p>
                  <button
                    onClick={fetchSuggestions}
                    disabled={isLoading}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      color: '#0369a1',
                      border: '1px solid #0369a1',
                      borderRadius: '4px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
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
                        padding: '10px 12px',
                        backgroundColor: 'white',
                        border: '1px solid #bae6fd',
                        borderRadius: '6px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1f2937',
                        lineHeight: '1.4',
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#7dd3fc';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#bae6fd';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Click to add to your message (you can edit before sending)
                </p>
              </div>

              {/* Tip Section */}
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#fefce8',
                  borderRadius: '6px',
                  border: '1px solid #fde047',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>💡</span>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 600, color: '#854d0e' }}>
                      Tip
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#713f12', lineHeight: '1.4' }}>
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
              <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '14px' }}>
                Get AI-powered suggestions to help you respond
              </p>
              <button
                onClick={fetchSuggestions}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0369a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
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
