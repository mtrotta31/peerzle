import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMembership, joinCommunity } from '../services/api';

export default function DemoRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'joining' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleDemoRedirect = async () => {
      // Wait for auth check to complete
      if (isLoading) return;

      // If not authenticated, redirect to login with returnTo param
      if (!isAuthenticated) {
        navigate('/login?returnTo=/demo', { replace: true });
        return;
      }

      // Check if user is already in demo community
      try {
        // Try to get membership - if it succeeds, user is already a member
        await getMembership('demo');
        // Already in demo community, redirect
        navigate('/community/demo', { replace: true });
      } catch {
        // Not in demo community, auto-join
        try {
          setStatus('joining');
          await joinCommunity('demo');
          navigate('/community/demo', { replace: true });
        } catch (joinErr) {
          console.error('Failed to join demo community:', joinErr);
          setError('Failed to join demo community. Please try again.');
          setStatus('error');
        }
      }
    };

    handleDemoRedirect();
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading state
  if (isLoading || status === 'checking' || status === 'joining') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          padding: '20px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '3px solid #E2E8F0',
            borderTopColor: '#2B7CF6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <p style={{ color: '#64748B', fontSize: '16px' }}>
          {status === 'joining' ? 'Joining demo community...' : 'Loading...'}
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state
  if (status === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          padding: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B' }}>{error}</p>
          <button
            onClick={() => navigate('/communities')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 600,
            }}
          >
            Go to Communities
          </button>
        </div>
      </div>
    );
  }

  return null;
}
