import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Community, Membership, getCommunity, getMembership } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export default function CommunityDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, membershipData] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
        ]);
        setCommunity(communityData);
        setMembership(membershipData);
      } catch (err) {
        const axiosError = err as AxiosError<{ error: string }>;
        if (axiosError.response?.status === 404) {
          setError('Community not found or you are not a member');
        } else {
          setError('Failed to load community');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error || !community || !membership) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'red' }}>{error || 'Something went wrong'}</p>
        <Link to="/communities">Back to Communities</Link>
      </div>
    );
  }

  const { branding, terminology, topics } = community.config;
  const roleName = membership.role === 'helper' || membership.role === 'both'
    ? terminology.helper
    : terminology.seeker;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div
        style={{
          backgroundColor: branding.primaryColor,
          color: 'white',
          padding: '20px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0 }}>{community.name}</h1>
            <Link
              to="/communities"
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid white',
                borderRadius: '4px',
              }}
            >
              Back to Communities
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        {/* Welcome Card */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h2 style={{ margin: '0 0 8px 0', color: branding.primaryColor }}>
            Welcome, {user?.email}
          </h2>
          <p style={{ margin: 0, color: '#666' }}>
            Your role: <strong>{roleName}</strong>
          </p>
        </div>

        {/* Topics */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', color: branding.primaryColor }}>
            Available Topics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {topics.map((topic) => (
              <div
                key={topic}
                style={{
                  padding: '12px 16px',
                  backgroundColor: `${branding.primaryColor}10`,
                  borderLeft: `3px solid ${branding.primaryColor}`,
                  borderRadius: '4px',
                }}
              >
                {topic}
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 16px 0', color: '#666' }}>
            Ready to connect with a {terminology.helper}?
          </p>
          <button
            disabled
            style={{
              padding: '16px 32px',
              backgroundColor: branding.secondaryColor,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'not-allowed',
              opacity: 0.6,
            }}
          >
            Start a {terminology.conversation}
          </button>
          <p style={{ margin: '16px 0 0 0', fontSize: '12px', color: '#999' }}>
            Coming soon
          </p>
        </div>
      </div>
    </div>
  );
}
