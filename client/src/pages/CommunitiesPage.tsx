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
    return <div style={{ padding: '20px' }}>Loading communities...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>Communities</h1>
        <div>
          <span style={{ marginRight: '16px' }}>{user?.email}</span>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      {communities.length === 0 ? (
        <p>No communities available.</p>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {communities.map((community) => (
            <div
              key={community.id}
              style={{
                border: `2px solid ${community.config.branding.primaryColor}`,
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px 0', color: community.config.branding.primaryColor }}>
                    {community.name}
                  </h2>
                  <p style={{ margin: '0 0 12px 0', color: '#666' }}>
                    {community.config.topics.length} support topics available
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {community.config.topics.slice(0, 4).map((topic) => (
                      <span
                        key={topic}
                        style={{
                          backgroundColor: `${community.config.branding.primaryColor}20`,
                          color: community.config.branding.primaryColor,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                    {community.config.topics.length > 4 && (
                      <span style={{ color: '#666', fontSize: '12px', padding: '4px' }}>
                        +{community.config.topics.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {community.membership ? (
                    <button
                      onClick={() => handleEnter(community.slug)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: community.config.branding.primaryColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      Enter
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoin(community.slug)}
                      disabled={joiningSlug === community.slug}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: community.config.branding.secondaryColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: joiningSlug === community.slug ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
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
    </div>
  );
}
