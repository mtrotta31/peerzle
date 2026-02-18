import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMembership, getCommunity, Membership, Community } from '../services/api';
import BottomNav from './BottomNav';

interface CommunityLayoutProps {
  children: React.ReactNode;
}

export default function CommunityLayout({ children }: CommunityLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        const [membershipData, communityData] = await Promise.all([
          getMembership(slug),
          getCommunity(slug),
        ]);
        setMembership(membershipData);
        setCommunity(communityData);
      } catch (err) {
        console.error('Failed to load community layout data:', err);
        setError('Failed to load community data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug, navigate]);

  // If no slug, just render children without bottom nav
  if (!slug) {
    return <>{children}</>;
  }

  // Show loading state
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
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  // If error or no membership, render children without nav (let child handle error)
  if (error || !membership) {
    return <>{children}</>;
  }

  // Get accent color from community config, fallback to default blue
  const accentColor = community?.config?.branding?.primaryColor || '#2B7CF6';

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      {children}
      <BottomNav
        communitySlug={slug}
        userRole={membership.role as 'seeker' | 'helper' | 'both' | 'admin'}
        accentColor={accentColor}
      />
    </div>
  );
}
