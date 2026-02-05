import { useState } from 'react';
import { submitRating, SubmitRatingData, setPostMood, saveConversation } from '../services/api';
import { MOODS } from './MoodCheckModal';

interface PostChatModalProps {
  conversationId: string;
  preMood: number | null;
  helperDisplayName: string | null;
  onClose: () => void;
  onComplete: () => void;
}

const BADGES = [
  { id: 'great_listener', emoji: '\uD83C\uDFAF', label: 'Great Listener' },
  { id: 'helpful_advice', emoji: '\uD83D\uDCA1', label: 'Helpful Advice' },
  { id: 'felt_heard', emoji: '\u2764\uFE0F', label: 'Made Me Feel Heard' },
  { id: 'above_beyond', emoji: '\uD83C\uDF1F', label: 'Went Above & Beyond' },
  { id: 'easy_to_talk', emoji: '\uD83E\uDD1D', label: 'Easy to Talk To' },
  { id: 'understood_me', emoji: '\uD83E\uDDE0', label: 'Really Understood Me' },
];

export default function PostChatModal({
  conversationId,
  preMood,
  helperDisplayName,
  onClose,
  onComplete,
}: PostChatModalProps) {
  const [step, setStep] = useState(1);
  const [postMoodValue, setPostMoodValue] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feltHeard, setFeltHeard] = useState<boolean | null>(null);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const moodImproved = preMood != null && postMoodValue != null && postMoodValue > preMood;

  const getMoodEmoji = (value: number) => {
    const mood = MOODS.find((m) => m.value === value);
    return mood?.emoji ?? '';
  };

  const getMoodComparisonLabel = () => {
    if (preMood == null || postMoodValue == null) return '';
    if (postMoodValue > preMood) return "You're feeling better!";
    if (postMoodValue === preMood) return 'We hope talking helped';
    return 'We hope talking helped';
  };

  // Step 1: Post mood
  const handlePostMoodNext = async () => {
    if (postMoodValue === null) return;
    setIsSubmitting(true);
    try {
      await setPostMood(conversationId, postMoodValue);
    } catch (err) {
      console.error('Failed to save post-mood:', err);
    }
    setIsSubmitting(false);
    setStep(2);
  };

  // Step 2: Star rating
  const handleRatingNext = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      const data: SubmitRatingData = {
        conversationId,
        rating,
        role: 'seeker',
        feltHeard: feltHeard ?? undefined,
      };
      await submitRating(data);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
    setIsSubmitting(false);
    setStep(3);
  };

  // Step 3: Badges
  const handleBadgesNext = async () => {
    if (selectedBadges.length > 0) {
      setIsSubmitting(true);
      try {
        // Re-submit post mood with badges
        await setPostMood(conversationId, postMoodValue ?? 3, selectedBadges);
      } catch (err) {
        console.error('Failed to save badges:', err);
      }
      setIsSubmitting(false);
    }
    setStep(4);
  };

  // Step 4: Save
  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await saveConversation(conversationId);
    } catch (err) {
      console.error('Failed to save conversation:', err);
    }
    setIsSubmitting(false);
    setShowThankYou(true);
    setTimeout(() => onComplete(), 2000);
  };

  const handleNoThanks = () => {
    setShowThankYou(true);
    setTimeout(() => onComplete(), 2000);
  };

  const toggleBadge = (id: string) => {
    setSelectedBadges((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const displayRating = hoveredRating || rating;
  const helperName = helperDisplayName || 'your helper';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Thank You Screen */}
        {showThankYou && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {moodImproved ? '\u2728' : '\uD83D\uDC99'}
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
              Thank you!
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
              Your feedback helps improve Peerzle for everyone
            </p>
          </div>
        )}

        {/* Step 1: Post Mood */}
        {!showThankYou && step === 1 && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F', textAlign: 'center' }}>
              How are you feeling now?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
              After your conversation
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
              {MOODS.map((mood) => {
                const isSelected = postMoodValue === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => setPostMoodValue(mood.value)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '16px',
                      transition: 'transform 0.2s',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
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
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      {mood.emoji}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
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

            {/* Mood comparison */}
            {preMood != null && postMoodValue != null && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: moodImproved ? '#ECFDF5' : '#F8FAFC',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  transition: 'background-color 0.3s',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                  Before: {getMoodEmoji(preMood)} → After: {getMoodEmoji(postMoodValue)}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: moodImproved ? '#16A34A' : '#64748B',
                    fontWeight: 500,
                  }}
                >
                  {getMoodComparisonLabel()}
                </p>
                {moodImproved && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '12px',
                      color: '#16A34A',
                      letterSpacing: '2px',
                    }}
                  >
                    {'\u2728\u2728\u2728'}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handlePostMoodNext}
              disabled={postMoodValue === null || isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: postMoodValue === null || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: postMoodValue === null || isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : 'Next'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '12px',
                padding: '8px',
              }}
            >
              Skip for now
            </button>
          </>
        )}

        {/* Step 2: Star Rating */}
        {!showThankYou && step === 2 && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F', textAlign: 'center' }}>
              How was this conversation?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
              Your feedback helps us improve
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '32px',
                    color: star <= displayRating ? '#F59E0B' : '#D1D5DB',
                    transition: 'transform 0.2s',
                    transform: star <= displayRating ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {'\u2605'}
                </button>
              ))}
            </div>

            {/* Felt Heard */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 500, color: '#1E3A5F' }}>
                Did you feel heard?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setFeltHeard(val)}
                    style={{
                      flex: 1,
                      padding: '8px 20px',
                      backgroundColor: feltHeard === val ? '#2B7CF6' : 'white',
                      color: feltHeard === val ? 'white' : '#64748B',
                      border: `2px solid ${feltHeard === val ? '#2B7CF6' : '#E2E8F0'}`,
                      borderRadius: '24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {val ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRatingNext}
              disabled={rating === 0 || isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: rating === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: rating === 0 || isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : 'Next'}
            </button>
          </>
        )}

        {/* Step 3: Compliment Badges */}
        {!showThankYou && step === 3 && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F', textAlign: 'center' }}>
              Give {helperName} a compliment
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
              Select any that apply
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '24px',
              }}
            >
              {BADGES.map((badge) => {
                const isSelected = selectedBadges.includes(badge.id);
                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() => toggleBadge(badge.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      backgroundColor: isSelected ? '#EDF4FF' : 'white',
                      color: isSelected ? '#2B7CF6' : '#1E3A5F',
                      border: `2px solid ${isSelected ? '#2B7CF6' : '#E2E8F0'}`,
                      borderRadius: '24px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>{badge.emoji}</span>
                    {badge.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleBadgesNext}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : selectedBadges.length > 0 ? 'Next' : 'Next'}
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '12px',
                padding: '8px',
              }}
            >
              Skip
            </button>
          </>
        )}

        {/* Step 4: Save Conversation */}
        {!showThankYou && step === 4 && (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F', textAlign: 'center' }}>
              Save this conversation?
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
              Saved conversations appear in your Session History for personal reflection.
            </p>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#2B7CF6',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleNoThanks}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '12px',
                padding: '8px',
              }}
            >
              No thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export { BADGES };
