import { useState, useEffect, useRef, useCallback } from 'react';
import { SuggestionsMessage, generateSuggestions, generateCoachingTip } from '../services/api';

interface SuggestionsPanelProps {
  conversationId: string;
  recentMessages: SuggestionsMessage[];
  mode: 'helper' | 'seeker';
  onSuggestionClick: (suggestion: string) => void;
}

const SUGGESTIONS_COOLDOWN_MS = 10000;
const COACHING_COOLDOWN_MS = 15000;
const SEEKER_PAUSE_MS = 60000;

export default function SuggestionsPanel({
  conversationId,
  recentMessages,
  mode,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Coaching tip state (helper only)
  const [coachingTip, setCoachingTip] = useState<string | null>(null);
  const [isCoachingLoading, setIsCoachingLoading] = useState(false);
  const coachingLastFetchRef = useRef(0);
  const coachingPendingRef = useRef<NodeJS.Timeout | null>(null);
  const coachingHasFetchedRef = useRef(false);
  const coachingSeekerCountRef = useRef(0);

  // Suggestions state (both modes)
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsLastFetchRef = useRef(0);

  // Seeker pause detection
  const lastMessageTimestampRef = useRef(Date.now());
  const [seekerPaused, setSeekerPaused] = useState(false);

  // -- Coaching tip fetching (helper only) --

  const fetchCoachingTip = useCallback(async () => {
    setIsCoachingLoading(true);
    try {
      const response = await generateCoachingTip(conversationId, recentMessages);
      setCoachingTip(response.tip);
      coachingHasFetchedRef.current = true;
      coachingLastFetchRef.current = Date.now();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 429) {
          setIsCoachingLoading(false);
          return;
        }
      }
      // On failure, show generic fallback only if we have nothing
      if (!coachingTip) {
        setCoachingTip('Listen actively and validate their feelings before offering suggestions.');
      }
      console.error('Failed to fetch coaching tip:', err);
    } finally {
      setIsCoachingLoading(false);
    }
  }, [conversationId, recentMessages, coachingTip]);

  const scheduleCoachingFetch = useCallback(() => {
    const now = Date.now();
    const elapsed = now - coachingLastFetchRef.current;

    if (coachingPendingRef.current) {
      clearTimeout(coachingPendingRef.current);
      coachingPendingRef.current = null;
    }

    if (elapsed >= COACHING_COOLDOWN_MS) {
      fetchCoachingTip();
    } else {
      const remaining = COACHING_COOLDOWN_MS - elapsed;
      coachingPendingRef.current = setTimeout(() => {
        coachingPendingRef.current = null;
        fetchCoachingTip();
      }, remaining);
    }
  }, [fetchCoachingTip]);

  // Fetch coaching tip when panel is first expanded
  useEffect(() => {
    if (mode !== 'helper') return;
    if (isExpanded && !coachingHasFetchedRef.current) {
      fetchCoachingTip();
    }
  }, [isExpanded, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update coaching tip on new seeker message
  useEffect(() => {
    if (mode !== 'helper' || !isExpanded) return;

    const seekerMessages = recentMessages.filter((m) => m.role === 'seeker');
    const currentCount = seekerMessages.length;

    if (currentCount > coachingSeekerCountRef.current && coachingHasFetchedRef.current) {
      scheduleCoachingFetch();
    }

    coachingSeekerCountRef.current = currentCount;
  }, [recentMessages, mode, isExpanded, scheduleCoachingFetch]);

  // Cleanup coaching timeout
  useEffect(() => {
    return () => {
      if (coachingPendingRef.current) {
        clearTimeout(coachingPendingRef.current);
      }
    };
  }, []);

  // -- Suggestions fetching --

  const fetchSuggestions = useCallback(async () => {
    setIsSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const fetchMode = mode === 'helper' ? 'helper' : 'seeker';
      const response = await generateSuggestions(conversationId, recentMessages, fetchMode);
      setSuggestions(response.suggestions);
      setTappedIndex(null);
      suggestionsLastFetchRef.current = Date.now();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number } };
        if (axiosErr.response?.status === 429) {
          setSuggestionsError('Please wait a moment before refreshing.');
          setIsSuggestionsLoading(false);
          return;
        }
      }
      console.error('Failed to fetch suggestions:', err);
      setSuggestionsError('Suggestions unavailable right now.');
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [conversationId, recentMessages, mode]);

  const handleShowSuggestions = () => {
    setShowSuggestions(true);
    fetchSuggestions();
  };

  const handleRefreshSuggestions = () => {
    const elapsed = Date.now() - suggestionsLastFetchRef.current;
    if (elapsed >= SUGGESTIONS_COOLDOWN_MS) {
      fetchSuggestions();
    }
  };

  const handleChipClick = (suggestion: string, index: number) => {
    setTappedIndex(index);
    onSuggestionClick(suggestion);
  };

  // -- Seeker: reset tappedIndex when message count changes (user sent a message) --

  const seekerMessageCountRef = useRef(0);

  useEffect(() => {
    if (mode !== 'seeker') return;
    const seekerMessages = recentMessages.filter((m) => m.role === 'seeker');
    const currentCount = seekerMessages.length;

    // If seeker sent a new message, re-enable chips
    if (currentCount > seekerMessageCountRef.current && tappedIndex !== null) {
      setTappedIndex(null);
    }
    seekerMessageCountRef.current = currentCount;
  }, [recentMessages, mode, tappedIndex]);

  // -- Seeker pause detection --

  useEffect(() => {
    if (mode !== 'seeker') return;
    if (recentMessages.length > 0) {
      lastMessageTimestampRef.current = Date.now();
      setSeekerPaused(false);
    }
  }, [recentMessages, mode]);

  useEffect(() => {
    if (mode !== 'seeker') return;

    const interval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - lastMessageTimestampRef.current;
      if (timeSinceLastMessage > SEEKER_PAUSE_MS) {
        setSeekerPaused(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [mode]);

  // -- Render --

  const shimmerKeyframes = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes tipFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;

  const renderSuggestionChips = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', position: 'relative' }}>
      {/* Error state */}
      {suggestionsError && !isSuggestionsLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            borderRadius: '12px',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '14px', color: '#DC2626' }}>{suggestionsError}</span>
          <button
            onClick={fetchSuggestions}
            style={{
              padding: '6px 12px',
              backgroundColor: 'white',
              color: '#DC2626',
              border: '1px solid #DC2626',
              borderRadius: '16px',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {isSuggestionsLoading && !suggestions && (
        <>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '38px',
                width: `${100 + i * 30}px`,
                borderRadius: '20px',
                background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          ))}
        </>
      )}
      {isSuggestionsLoading && suggestions && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            zIndex: 1,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '38px',
                width: `${100 + i * 30}px`,
                borderRadius: '20px',
                background: 'linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      )}
      {suggestions?.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => handleChipClick(suggestion, index)}
          disabled={tappedIndex !== null}
          style={{
            padding: '10px 16px',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            background: 'white',
            fontSize: '14px',
            color: '#1E3A5F',
            cursor: tappedIndex !== null ? 'default' : 'pointer',
            opacity: tappedIndex !== null ? 0.5 : (isSuggestionsLoading ? 0 : 1),
            pointerEvents: tappedIndex !== null ? 'none' : 'auto',
            transition: 'all 0.2s',
            textAlign: 'left',
            lineHeight: '1.3',
          }}
          onMouseOver={(e) => {
            if (tappedIndex === null && !isSuggestionsLoading) {
              e.currentTarget.style.borderColor = '#2B7CF6';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
            }
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
  );

  if (mode === 'helper') {
    return (
      <div style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <style>{shimmerKeyframes}</style>

        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            height: '40px',
            padding: '0 20px',
            backgroundColor: '#F8FAFC',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>{'\u{1F4A1}'}</span>
            <span style={{ fontWeight: 500, color: '#1E3A5F', fontSize: '14px' }}>
              Helper Guide
            </span>
          </div>
          <span
            style={{
              color: '#64748B',
              fontSize: '12px',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            {'\u25BC'}
          </span>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div style={{ padding: '0 20px 12px', maxHeight: '220px', overflowY: 'auto' }}>
            {/* Coaching Tip Section */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FFF8E7',
                borderLeft: '3px solid #F59E0B',
                borderRadius: '0 8px 8px 0',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{'\u{1F393}'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isCoachingLoading && !coachingTip && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontStyle: 'italic' }}>
                      Listening to the conversation...
                    </p>
                  )}
                  {coachingTip && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#78350F',
                        lineHeight: '1.4',
                        animation: 'tipFadeIn 0.3s ease-in',
                      }}
                    >
                      {coachingTip}
                    </p>
                  )}
                  {!isCoachingLoading && !coachingTip && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#92400E', fontStyle: 'italic' }}>
                      Listening to the conversation...
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Suggested Responses Section */}
            {!showSuggestions ? (
              <button
                onClick={handleShowSuggestions}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2B7CF6',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'none',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                Show suggested responses
              </button>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                    Suggested Responses
                  </span>
                  <button
                    onClick={handleRefreshSuggestions}
                    style={{
                      fontSize: '16px',
                      color: '#64748B',
                      cursor: 'pointer',
                      lineHeight: 1,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    title="Refresh suggestions"
                    aria-label="Refresh suggestions"
                  >
                    {'\u21BB'}
                  </button>
                </div>
                {renderSuggestionChips()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // -- Seeker mode --
  return (
    <div style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <style>{shimmerKeyframes}</style>

      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          height: '40px',
          padding: '0 20px',
          backgroundColor: '#F8FAFC',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>{'\u{1F4AC}'}</span>
          <span style={{ fontWeight: 500, color: '#1E3A5F', fontSize: '14px' }}>
            Not sure what to say?
          </span>
        </div>
        <span
          style={{
            color: '#64748B',
            fontSize: '12px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          {'\u25BC'}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: '0 20px 12px', maxHeight: '220px', overflowY: 'auto' }}>
          {/* Reassurance message */}
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
            {seekerPaused
              ? "Take your time \u2014 there's no rush. Your helper is here whenever you're ready."
              : "There's no wrong way to start. Share whatever feels comfortable."}
          </p>

          {/* Conversation starters */}
          {!showSuggestions ? (
            <button
              onClick={handleShowSuggestions}
              style={{
                background: 'none',
                border: 'none',
                color: '#2B7CF6',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Show conversation starters
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                  Conversation Starters
                </span>
                <button
                  onClick={handleRefreshSuggestions}
                  style={{
                    fontSize: '16px',
                    color: '#64748B',
                    cursor: 'pointer',
                    lineHeight: 1,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                  }}
                  title="Get new suggestions"
                  aria-label="Get new suggestions"
                >
                  {'\u21BB'}
                </button>
              </div>
              {renderSuggestionChips()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
