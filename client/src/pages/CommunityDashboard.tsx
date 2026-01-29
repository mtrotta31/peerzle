import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Community, Membership, Conversation, getCommunity, getMembership, startConversation, getActiveConversations } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export default function CommunityDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const [communityData, membershipData, activeConvs] = await Promise.all([
          getCommunity(slug),
          getMembership(slug),
          getActiveConversations(),
        ]);
        setCommunity(communityData);
        setMembership(membershipData);

        // Check if user has an active conversation in this community
        const existingConv = activeConvs.find(
          (c) => c.community_id === communityData.id
        );
        if (existingConv) {
          setActiveConversation(existingConv);
        }
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

  const handleStartConversation = async (topic: string) => {
    if (!slug || isStarting) return;

    setIsStarting(true);
    try {
      const conversation = await startConversation(slug, topic);
      navigate(`/chat/${conversation.id}`);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; conversationId?: string }>;
      if (axiosError.response?.data?.conversationId) {
        // Already have an active conversation
        navigate(`/chat/${axiosError.response.data.conversationId}`);
      } else {
        alert(axiosError.response?.data?.error || 'Failed to start conversation');
      }
    } finally {
      setIsStarting(false);
    }
  };

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

        {/* Active Conversation Banner */}
        {activeConversation && (
          <div
            style={{
              backgroundColor: branding.secondaryColor,
              color: 'white',
              borderRadius: '8px',
              padding: '16px 24px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                You have an active {terminology.conversation.toLowerCase()}
              </p>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                Topic: {activeConversation.topic || 'General Support'}
              </p>
            </div>
            <button
              onClick={() => navigate(`/chat/${activeConversation.id}`)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'white',
                color: branding.secondaryColor,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Continue
            </button>
          </div>
        )}

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
          <h3 style={{ margin: '0 0 8px 0', color: branding.primaryColor }}>
            {activeConversation ? 'Topics' : `Start a ${terminology.conversation}`}
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
            {activeConversation
              ? 'End your current session to start a new one'
              : 'Click on a topic to connect with a ' + terminology.helper}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => !activeConversation && handleStartConversation(topic)}
                disabled={isStarting || !!activeConversation}
                style={{
                  padding: '12px 16px',
                  backgroundColor: activeConversation ? '#f3f4f6' : `${branding.primaryColor}10`,
                  borderLeft: `3px solid ${activeConversation ? '#9ca3af' : branding.primaryColor}`,
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderRadius: '4px',
                  textAlign: 'left',
                  cursor: activeConversation ? 'not-allowed' : 'pointer',
                  color: activeConversation ? '#9ca3af' : '#1f2937',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!activeConversation) {
                    e.currentTarget.style.backgroundColor = `${branding.primaryColor}20`;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!activeConversation) {
                    e.currentTarget.style.backgroundColor = `${branding.primaryColor}10`;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
