import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MOODS } from '../components/MoodCheckModal';
import {
  getCommunity,
  getTodayCheckIn,
  submitMoodCheckIn,
  getMoodStreak,
  getMoodHistory,
  Community,
  TodayCheckInResponse,
  MoodStreakResponse,
  MoodCheckIn,
} from '../services/api';

// Color mapping for mood scores (from MoodHistoryPage)
const MOOD_COLORS: Record<number, string> = {
  1: '#DC2626', // Much Worse - red
  2: '#F59E0B', // Slightly Down - amber
  3: '#94A3B8', // Neutral - gray
  4: '#22C55E', // Okay - light green
  5: '#16A34A', // Good - green
};

export default function MoodCheckInPage() {
  const { slug } = useParams<{ slug: string }>();

  const [community, setCommunity] = useState<Community | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayCheckInResponse | null>(null);
  const [streakData, setStreakData] = useState<MoodStreakResponse | null>(null);
  const [checkins, setCheckins] = useState<MoodCheckIn[]>([]);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const communityData = await getCommunity(slug);
        setCommunity(communityData);

        const [today, streak, historyData] = await Promise.all([
          getTodayCheckIn(communityData.id),
          getMoodStreak(communityData.id),
          getMoodHistory(communityData.id, 30),
        ]);

        setTodayStatus(today);
        setStreakData(streak);
        setCheckins(historyData.checkins);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const handleSubmit = async () => {
    if (selectedMood === null || !community) return;

    setIsSubmitting(true);
    try {
      const result = await submitMoodCheckIn(community.id, selectedMood, note || undefined);

      // Update local state
      setStreakData(prev => ({
        current_streak: result.streak,
        longest_streak: prev?.longest_streak || result.streak,
        checked_in_today: true,
      }));
      setTodayStatus({
        checked_in: true,
        check_in: {
          id: result.id,
          mood_score: selectedMood,
          source: 'standalone',
          note: note || null,
          created_at: result.created_at,
        },
      });

      // Add to checkins list
      setCheckins(prev => [{
        id: result.id,
        mood_score: selectedMood,
        source: 'standalone',
        note: note || null,
        created_at: result.created_at,
      }, ...prev]);

      setJustSubmitted(true);
      setSelectedMood(null);
      setNote('');
    } catch (err) {
      console.error('Failed to submit mood:', err);
      setError('Failed to save your check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      </div>
    );
  }

  const checkInsByDate = getCheckInsByDate();
  const averageMood = getAverageMood();
  const hasCheckedInToday = todayStatus?.checked_in || false;

  // Render history section (used after check-in or if already checked in)
  const renderHistory = () => (
    <>
      {/* Stats summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '20px',
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
            {streakData && streakData.current_streak >= 3 && ' '}
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            Day Streak {streakData && streakData.current_streak >= 3 && '!'}
          </p>
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
      {checkins.length > 0 && (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#1E3A5F' }}>
            How You've Been Feeling
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
    </>
  );

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
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1E3A5F' }}>
            Daily Check-In
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 24px' }}>
        {/* Just submitted success message */}
        {justSubmitted && (
          <div
            style={{
              backgroundColor: '#DCFCE7',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'white',
                fontSize: '24px',
              }}
            >
              &#10003;
            </div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#166534', fontSize: '16px' }}>
              Thanks for checking in!
            </p>
            {streakData && streakData.current_streak > 0 && (
              <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                {streakData.current_streak} day streak {streakData.current_streak >= 3 ? '!' : ''}
              </p>
            )}
          </div>
        )}

        {/* Show check-in form if not checked in today and not just submitted */}
        {!hasCheckedInToday && !justSubmitted && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '32px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: '22px',
                fontWeight: 600,
                color: '#1E3A5F',
              }}
            >
              How are you feeling today?
            </h2>
            <p
              style={{
                margin: '0 0 32px 0',
                fontSize: '14px',
                color: '#64748B',
              }}
            >
              Quick check-in to track how you're doing
            </p>

            {error && (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontSize: '14px',
                }}
              >
                {error}
              </div>
            )}

            {/* Mood options */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-evenly',
                flexWrap: 'nowrap',
                marginBottom: '32px',
                padding: '0 8px',
              }}
            >
              {MOODS.map((mood) => {
                const isSelected = selectedMood === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => setSelectedMood(mood.value)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '12px',
                      transition: 'transform 0.2s',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      minWidth: '56px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '36px',
                        lineHeight: 1,
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? '0 0 0 3px #2B7CF6' : 'none',
                        backgroundColor: isSelected ? '#EDF4FF' : 'transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      {mood.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: isSelected ? '#2B7CF6' : '#94A3B8',
                        fontWeight: isSelected ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {mood.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional note */}
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#64748B',
                  marginBottom: '8px',
                }}
              >
                Add a quick note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="e.g., rough shift, good day with family..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  fontSize: '15px',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8', textAlign: 'right' }}>
                {note.length}/200
              </p>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedMood === null || isSubmitting}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: selectedMood === null || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: selectedMood === null || isSubmitting ? 0.5 : 1,
                transition: 'background-color 0.2s',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Check-In'}
            </button>
          </div>
        )}

        {/* Streak hint when form is shown */}
        {!hasCheckedInToday && !justSubmitted && streakData && streakData.current_streak > 0 && (
          <p
            style={{
              textAlign: 'center',
              marginBottom: '24px',
              fontSize: '14px',
              color: '#64748B',
            }}
          >
            Keep it going! You're on a {streakData.current_streak} day streak{' '}
            {streakData.current_streak >= 3 ? '' : ''}
          </p>
        )}

        {/* Today's mood summary if checked in */}
        {hasCheckedInToday && !justSubmitted && todayStatus?.check_in && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <span style={{ fontSize: '40px' }}>
              {MOODS.find(m => m.value === todayStatus.check_in?.mood_score)?.emoji || ''}
            </span>
            <div>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#1E3A5F', fontSize: '15px' }}>
                Today you're feeling {MOODS.find(m => m.value === todayStatus.check_in?.mood_score)?.label || 'good'}
              </p>
              {streakData && streakData.current_streak > 0 && (
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                  {streakData.current_streak} day streak {streakData.current_streak >= 3 ? '' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Always show history if we have data */}
        {(hasCheckedInToday || justSubmitted) && renderHistory()}

        {/* Empty state if no check-ins yet and haven't just submitted */}
        {checkins.length === 0 && !justSubmitted && !hasCheckedInToday && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ fontSize: '40px', marginBottom: '12px' }}>&#128200;</p>
            <p style={{ margin: 0, color: '#64748B' }}>
              Start tracking how you're feeling. Your history will appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
