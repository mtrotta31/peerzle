import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Community, Membership, getCommunities, getMembership, joinCommunity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

interface CommunityWithMembership extends Community {
  membership?: Membership;
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<CommunityWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCommunities() {
      try {
        const communityList = await getCommunities();

        // Check membership for each community
        const communitiesWithMembership = await Promise.all(
          communityList.map(async (community) => {
            try {
              const membership = await getMembership(community.slug);
              return { ...community, membership };
            } catch {
              return community;
            }
          })
        );

        setCommunities(communitiesWithMembership);
      } catch (error) {
        console.error('Failed to load communities:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadCommunities();
  }, []);

  const handleJoin = async (slug: string) => {
    setJoiningSlug(slug);
    try {
      await joinCommunity(slug);
      navigate(`/community/${slug}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ error: string }>;
      alert(axiosError.response?.data?.error || 'Failed to join community');
    } finally {
      setJoiningSlug(null);
    }
  };

  const handleEnter = (slug: string) => {
    navigate(`/community/${slug}`);
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
        <p style={{ color: '#64748B' }}>Loading communities...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <img
            src="/peerzle-logo-horizontal.svg"
            alt="Peerzle"
            style={{ height: '36px', width: 'auto' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#64748B', fontSize: '14px' }}>{user?.email}</span>
            <button
              onClick={logout}
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
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#CBD5E1';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        <h1
          style={{
            margin: '0 0 24px 0',
            fontSize: '24px',
            fontWeight: 600,
            color: '#1E3A5F',
          }}
        >
          Your Communities
        </h1>

        {communities.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ color: '#64748B', margin: 0 }}>No communities available.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {communities.map((community) => (
              <div
                key={community.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() =>
                  community.membership
                    ? handleEnter(community.slug)
                    : handleJoin(community.slug)
                }
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h2
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '18px',
                        fontWeight: 600,
                        color: '#1E3A5F',
                      }}
                    >
                      {community.name}
                    </h2>
                    <p
                      style={{
                        margin: '0 0 16px 0',
                        color: '#64748B',
                        fontSize: '14px',
                      }}
                    >
                      {community.config.topics.length} support topics available
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {community.config.topics.slice(0, 4).map((topic) => (
                        <span
                          key={topic}
                          style={{
                            backgroundColor: '#EDF4FF',
                            color: '#2B7CF6',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {topic}
                        </span>
                      ))}
                      {community.config.topics.length > 4 && (
                        <span
                          style={{
                            color: '#64748B',
                            fontSize: '12px',
                            padding: '4px',
                          }}
                        >
                          +{community.config.topics.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {community.membership ? (
                      <button
                        onClick={() => handleEnter(community.slug)}
                        style={{
                          padding: '12px 28px',
                          backgroundColor: '#2B7CF6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '24px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#1E6AD9';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#2B7CF6';
                        }}
                      >
                        Enter
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(community.slug)}
                        disabled={joiningSlug === community.slug}
                        style={{
                          padding: '12px 28px',
                          backgroundColor: 'white',
                          color: '#2B7CF6',
                          border: '2px solid #2B7CF6',
                          borderRadius: '24px',
                          cursor: joiningSlug === community.slug ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                          opacity: joiningSlug === community.slug ? 0.7 : 1,
                          transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => {
                          if (joiningSlug !== community.slug) {
                            e.currentTarget.style.backgroundColor = '#EDF4FF';
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        {joiningSlug === community.slug ? 'Joining...' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
