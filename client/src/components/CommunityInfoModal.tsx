import { useState, useEffect } from 'react';
import { CommunityDetails, getCommunityDetails } from '../services/api';

interface CommunityInfoModalProps {
  communitySlug: string;
  communityName: string;
  isMember: boolean;
  onClose: () => void;
  onJoin: () => void;
  onEnter: () => void;
  isJoining?: boolean;
}

export default function CommunityInfoModal({
  communitySlug,
  communityName,
  isMember,
  onClose,
  onJoin,
  onEnter,
  isJoining,
}: CommunityInfoModalProps) {
  const [details, setDetails] = useState<CommunityDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetails() {
      try {
        const data = await getCommunityDetails(communitySlug);
        setDetails(data);
      } catch {
        setError('Failed to load community details');
      } finally {
        setIsLoading(false);
      }
    }
    loadDetails();
  }, [communitySlug]);

  const getVerificationBadge = (method: string) => {
    switch (method) {
      case 'open':
        return { label: 'Open', bgColor: '#DCFCE7', textColor: '#166534' };
      case 'invite_code':
        return { label: 'Invite Only', bgColor: '#FEF3C7', textColor: '#92400E' };
      case 'email_domain':
        return { label: 'Domain Verified', bgColor: '#DBEAFE', textColor: '#1E40AF' };
      default:
        return { label: 'Open', bgColor: '#DCFCE7', textColor: '#166534' };
    }
  };

  const badge = details ? getVerificationBadge(details.verification_method) : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '85vh',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: '#1E3A5F',
                lineHeight: 1.3,
              }}
            >
              {communityName}
            </h2>
            {badge && (
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  backgroundColor: badge.bgColor,
                  color: badge.textColor,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              marginLeft: '12px',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#DC2626' }}>
              {error}
            </div>
          ) : details ? (
            <>
              {/* Description */}
              {details.description && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    About
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#1E3A5F', lineHeight: 1.6 }}>
                    {details.description}
                  </p>
                </div>
              )}

              {/* Topics */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Topics ({details.topics.length})
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {details.topics.map((topic) => (
                    <span
                      key={topic}
                      style={{
                        display: 'inline-flex',
                        backgroundColor: '#EDF4FF',
                        color: '#2B7CF6',
                        padding: '5px 12px',
                        borderRadius: '14px',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Community Stats
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      flex: 1,
                      minWidth: '100px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1E3A5F' }}>
                      {details.member_count}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                      Members
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      flex: 1,
                      minWidth: '100px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1E3A5F' }}>
                      {details.organizations.length}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                      Organizations
                    </p>
                  </div>
                </div>
              </div>

              {/* Organizations */}
              {details.organizations.length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Organizations
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {details.organizations.map((org) => (
                      <div
                        key={org.id}
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          color: '#1E3A5F',
                          fontWeight: 500,
                        }}
                      >
                        {org.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px 20px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '10px 16px',
            }}
          >
            Close
          </button>
          <button
            onClick={isMember ? onEnter : onJoin}
            disabled={isJoining}
            style={{
              padding: '12px 28px',
              backgroundColor: isMember ? '#2B7CF6' : 'white',
              color: isMember ? 'white' : '#2B7CF6',
              border: isMember ? 'none' : '2px solid #2B7CF6',
              borderRadius: '24px',
              cursor: isJoining ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              opacity: isJoining ? 0.7 : 1,
              transition: 'background-color 0.2s',
            }}
          >
            {isJoining ? 'Joining...' : isMember ? 'Enter' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}
