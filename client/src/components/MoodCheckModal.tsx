import { useState } from 'react';
import { setPreMood } from '../services/api';

interface MoodCheckModalProps {
  conversationId: string;
  onComplete: () => void;
}

const MOODS = [
  { value: 1, emoji: '\uD83D\uDE2B', label: 'Worse' },
  { value: 2, emoji: '\uD83D\uDE1F', label: 'Down' },
  { value: 3, emoji: '\uD83D\uDE10', label: 'Neutral' },
  { value: 4, emoji: '\uD83D\uDE42', label: 'Okay' },
  { value: 5, emoji: '\uD83D\uDE0A', label: 'Good' },
];

export default function MoodCheckModal({ conversationId, onComplete }: MoodCheckModalProps) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (selectedMood === null) return;

    setIsSubmitting(true);
    try {
      await setPreMood(conversationId, selectedMood);
      onComplete();
    } catch (err) {
      console.error('Failed to set pre-mood:', err);
      // Still proceed even if save fails
      onComplete();
    }
  };

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
          padding: '40px 32px 32px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
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
          How are you feeling right now?
        </h2>
        <p
          style={{
            margin: '0 0 32px 0',
            fontSize: '14px',
            color: '#64748B',
          }}
        >
          This quick check-in helps us understand how you're doing
        </p>

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
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '12px',
                  transition: 'transform 0.2s',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  minWidth: '48px',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    lineHeight: 1,
                    width: '40px',
                    height: '40px',
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
                    fontSize: '10px',
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

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={selectedMood === null || isSubmitting}
          style={{
            width: '100%',
            padding: '14px',
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
          onMouseOver={(e) => {
            if (selectedMood !== null && !isSubmitting) {
              e.currentTarget.style.backgroundColor = '#1E6AD9';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#2B7CF6';
          }}
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export { MOODS };
