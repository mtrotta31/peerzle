import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MOODS } from '../components/MoodCheckModal';
import {
  getCommunity,
  getTodayCheckIn,
  submitMoodCheckIn,
  getMoodStreak,
  Community,
  TodayCheckInResponse,
  MoodStreakResponse,
} from '../services/api';

export default function MoodCheckInPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [community, setCommunity] = useState<Community | null>(null);
  const [todayStatus, setTodayStatus] = useState<TodayCheckInResponse | null>(null);
  const [streakData, setStreakData] = useState<MoodStreakResponse | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedStreak, setSubmittedStreak] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        const communityData = await getCommunity(slug);
        setCommunity(communityData);

        const [today, streak] = await Promise.all([
          getTodayCheckIn(communityData.id),
          getMoodStreak(communityData.id),
        ]);

        setTodayStatus(today);
        setStreakData(streak);
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
      setSubmittedStreak(result.streak);
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit mood:', err);
      setError('Failed to save your check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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

  // Already checked in today
  if (todayStatus?.checked_in && !submitted) {
    const checkedInMood = MOODS.find((m) => m.value === todayStatus.check_in?.mood_score);
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
              Daily Check-In
            </h1>
          </div>
        </header>

        <main style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '40px 32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {checkedInMood?.emoji || '✓'}
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 600, color: '#1E3A5F' }}>
              You've already checked in today
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#64748B' }}>
              You're feeling <strong>{checkedInMood?.label || 'good'}</strong>
            </p>

            {streakData && streakData.current_streak > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: '#FEF3C7',
                  borderRadius: '20px',
                  marginBottom: '24px',
                }}
              >
                <span style={{ fontSize: '20px' }}>
                  {streakData.current_streak >= 3 ? '🔥' : '⭐'}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#92400E' }}>
                  {streakData.current_streak} day streak
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link
                to={`/community/${slug}/mood-history`}
                style={{
                  display: 'block',
                  padding: '14px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  borderRadius: '24px',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 600,
                }}
              >
                View My Mood History
              </Link>
              <button
                onClick={() => navigate(`/community/${slug}`)}
                style={{
                  padding: '14px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Success state after submission
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
        <main style={{ maxWidth: '600px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              padding: '48px 32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '40px',
              }}
            >
              ✓
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: '#1E3A5F' }}>
              Thanks for checking in!
            </h2>

            {submittedStreak > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: submittedStreak >= 3 ? '#FEF3C7' : '#EDF4FF',
                  borderRadius: '24px',
                  margin: '16px 0 24px',
                }}
              >
                <span style={{ fontSize: '24px' }}>
                  {submittedStreak >= 3 ? '🔥' : '⭐'}
                </span>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 600,
                    color: submittedStreak >= 3 ? '#92400E' : '#1E40AF',
                  }}
                >
                  {submittedStreak} day streak!
                </span>
              </div>
            )}

            <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B' }}>
              Checking in daily helps you track how you're doing over time.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => navigate(`/community/${slug}`)}
                style={{
                  padding: '14px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
              <Link
                to={`/community/${slug}/mood-history`}
                style={{
                  display: 'block',
                  padding: '14px',
                  backgroundColor: 'transparent',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  textDecoration: 'none',
                  fontSize: '16px',
                  fontWeight: 500,
                }}
              >
                View Mood History
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main check-in form
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
            Daily Check-In
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '32px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            textAlign: 'center',
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

        {/* Streak hint */}
        {streakData && streakData.current_streak > 0 && (
          <p
            style={{
              textAlign: 'center',
              marginTop: '16px',
              fontSize: '14px',
              color: '#64748B',
            }}
          >
            Keep it going! You're on a {streakData.current_streak} day streak{' '}
            {streakData.current_streak >= 3 ? '🔥' : '⭐'}
          </p>
        )}
      </main>
    </div>
  );
}
