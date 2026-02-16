import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MOODS } from '../components/MoodCheckModal';
import {
  getCommunity,
  getMoodHistory,
  getMoodStreak,
  Community,
  MoodCheckIn,
  MoodStreakResponse,
} from '../services/api';

// Color mapping for mood scores
const MOOD_COLORS: Record<number, string> = {
  1: '#DC2626', // Much Worse - red
  2: '#F59E0B', // Slightly Down - amber
  3: '#94A3B8', // Neutral - gray
  4: '#22C55E', // Okay - light green
  5: '#16A34A', // Good - green
};

export default function MoodHistoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [community, setCommunity] = useState<Community | null>(null);
  const [checkins, setCheckins] = useState<MoodCheckIn[]>([]);
  const [streakData, setStreakData] = useState<MoodStreakResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const communityData = await getCommunity(slug);
        setCommunity(communityData);

        const [historyData, streak] = await Promise.all([
          getMoodHistory(communityData.id, 30),
          getMoodStreak(communityData.id),
        ]);

        setCheckins(historyData.checkins);
        setStreakData(streak);
      } catch (err) {
        console.error('Failed to load mood history:', err);
        setError('Failed to load mood history');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  // Group check-ins by date
  const getCheckInsByDate = () => {
    const byDate: Record<string, MoodCheckIn[]> = {};

    checkins.forEach((checkin) => {
      const date = new Date(checkin.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(checkin);
    });

    return byDate;
  };

  // Calculate average mood
  const getAverageMood = () => {
    if (checkins.length === 0) return null;
    const sum = checkins.reduce((acc, c) => acc + c.mood_score, 0);
    return (sum / checkins.length).toFixed(1);
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
        <p style={{ color: '#64748B' }}>Loading...</p>
      </div>
    );
  }

  if (error && !community) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: '#DC2626' }}>{error}</p>
        <Link to="/communities" style={{ color: '#2B7CF6' }}>
          Back to Communities
        </Link>
      </div>
    );
  }

  const checkInsByDate = getCheckInsByDate();
  const averageMood = getAverageMood();

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
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(`/community/${slug}`)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
            }}
          >
            &larr;
          </button>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
            My Mood History
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        {/* Stats summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1E3A5F' }}>
              {checkins.length}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Check-ins</p>
          </div>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1E3A5F' }}>
              {streakData?.current_streak || 0}
              {streakData && streakData.current_streak >= 3 && ' 🔥'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Day Streak</p>
          </div>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1E3A5F' }}>
              {averageMood || '-'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Avg Mood</p>
          </div>
        </div>

        {/* Mood visualization */}
        {checkins.length > 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              marginBottom: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
              Last 30 Days
            </h3>

            {/* Simple dot visualization */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              {checkins.slice().reverse().map((checkin) => (
                <div
                  key={checkin.id}
                  title={`${new Date(checkin.created_at).toLocaleDateString()} - ${MOODS.find(m => m.value === checkin.mood_score)?.label || ''}`}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: MOOD_COLORS[checkin.mood_score] || '#94A3B8',
                    opacity: checkin.source === 'conversation' ? 0.7 : 1,
                    border: checkin.source === 'conversation' ? '2px solid white' : 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}
                />
              ))}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              {MOODS.map((mood) => (
                <div key={mood.value} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: MOOD_COLORS[mood.value],
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{mood.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              marginBottom: '24px',
            }}
          >
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>📊</p>
            <p style={{ margin: '0 0 16px', color: '#64748B' }}>
              No mood check-ins yet. Start tracking how you're feeling!
            </p>
            <Link
              to={`/community/${slug}/mood-checkin`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                borderRadius: '20px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Check In Now
            </Link>
          </div>
        )}

        {/* Recent check-ins list */}
        {checkins.length > 0 && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
              Recent Check-ins
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(checkInsByDate)
                .slice(0, 7)
                .map(([date, dayCheckins]) => (
                  <div
                    key={date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: '#1E3A5F' }}>
                        {date}
                      </p>
                      {dayCheckins[0].note && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                          "{dayCheckins[0].note}"
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {dayCheckins.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '20px' }}>
                            {MOODS.find((m) => m.value === c.mood_score)?.emoji}
                          </span>
                          {c.source === 'conversation' && (
                            <span
                              style={{
                                fontSize: '9px',
                                color: '#64748B',
                                backgroundColor: '#E2E8F0',
                                padding: '2px 4px',
                                borderRadius: '4px',
                              }}
                            >
                              chat
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Check-in button */}
        <div style={{ marginTop: '24px' }}>
          <Link
            to={`/community/${slug}/mood-checkin`}
            style={{
              display: 'block',
              width: '100%',
              padding: '16px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              borderRadius: '24px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            Check In Now
          </Link>
        </div>
      </main>
    </div>
  );
}
