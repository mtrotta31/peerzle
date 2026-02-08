import { useState } from 'react';
import { ConnectionData } from '../services/api';

interface ConnectionCardProps {
  connectionData: ConnectionData;
  userRole: 'seeker' | 'helper';
}

export default function ConnectionCard({ connectionData, userRole }: ConnectionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Trigger the entrance animation flag after mount
  if (!hasAnimated) {
    setTimeout(() => setHasAnimated(true), 50);
  }

  const score = connectionData.match_score;
  const scoreColor =
    score != null && score >= 80
      ? '#16A34A'
      : score != null && score >= 60
      ? '#D97706'
      : '#94A3B8';

  const otherDisplayName =
    userRole === 'seeker'
      ? connectionData.helper_display_name
      : connectionData.seeker_display_name;

  const chatLabel =
    userRole === 'seeker'
      ? `You're chatting with ${otherDisplayName || 'your Peer Supporter'}`
      : `You're helping ${otherDisplayName || 'your Peer'}`;

  const sharedTopics = connectionData.shared_topics;

  if (collapsed) {
    return (
      <div
        style={{
          padding: '8px 20px',
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {score != null && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: scoreColor,
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {score}
            </span>
          )}
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            {chatLabel}
          </span>
          {connectionData.helper_is_verified && userRole === 'seeker' && (
            <span
              style={{
                fontSize: '11px',
                color: '#16A34A',
                fontWeight: 600,
              }}
            >
              Verified
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Show details</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E2E8F0',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        opacity: hasAnimated ? 1 : 0,
        transform: hasAnimated ? 'translateY(0)' : 'translateY(-8px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        {/* Left: Score + Info */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          {/* Score badge */}
          {score != null && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: `3px solid ${scoreColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'white',
                }}
              >
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: scoreColor,
                  }}
                >
                  {score}
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  color: scoreColor,
                  fontWeight: 600,
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                }}
              >
                % match
              </span>
            </div>
          )}

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Display name + verified badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1E3A5F',
                }}
              >
                {chatLabel}
              </span>
              {connectionData.helper_is_verified && userRole === 'seeker' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '1px 8px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    color: '#16A34A',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✓ Verified Specialist
                </span>
              )}
              {connectionData.same_org && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '1px 8px',
                    borderRadius: '10px',
                    backgroundColor: '#EDF4FF',
                    color: '#2B7CF6',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Same Organization
                </span>
              )}
            </div>

            {/* Shared experience label */}
            {score != null && (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '12px',
                  color: '#64748B',
                }}
              >
                {score >= 60 ? `${score}% Shared Experience` : 'Your helper is here to listen'}
              </p>
            )}

            {/* Shared topics chips */}
            {sharedTopics.length > 0 ? (
              <div style={{ marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#94A3B8',
                    fontWeight: 500,
                  }}
                >
                  You both selected:
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    marginTop: '4px',
                  }}
                >
                  {sharedTopics.map((topic) => (
                    <span
                      key={topic}
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        backgroundColor: '#EDF4FF',
                        color: '#2B7CF6',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            ) : score == null || score < 60 ? (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '12px',
                  color: '#94A3B8',
                  fontStyle: 'italic',
                }}
              >
                Your helper is here to listen
              </p>
            ) : null}
          </div>
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#94A3B8',
            fontSize: '18px',
            lineHeight: 1,
            flexShrink: 0,
            marginLeft: '8px',
          }}
          title="Minimize"
          aria-label="Minimize connection card"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
