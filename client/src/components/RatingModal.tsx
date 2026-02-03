import { useState } from 'react';
import { submitRating, SubmitRatingData } from '../services/api';

interface RatingModalProps {
  conversationId: string;
  role: 'seeker' | 'helper';
  onClose: () => void;
  onSubmitted: () => void;
}

export default function RatingModal({ conversationId, role, onClose, onSubmitted }: RatingModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feltHeard, setFeltHeard] = useState<boolean | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: SubmitRatingData = {
        conversationId,
        rating,
        role,
        wouldRecommend: wouldRecommend ?? undefined,
        feedbackText: feedbackText.trim() || undefined,
      };

      if (role === 'seeker') {
        data.feltHeard = feltHeard ?? undefined;
      }

      await submitRating(data);
      onSubmitted();
    } catch (err) {
      console.error('Failed to submit rating:', err);
      setError('Failed to submit rating. Please try again.');
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

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
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 600,
            color: '#1E3A5F',
            textAlign: 'center',
          }}
        >
          How was your session?
        </h2>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          Your feedback helps us improve Peerzle
        </p>

        {/* Star Rating */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px',
          }}
        >
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
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Felt Heard - Seeker Only */}
        {role === 'seeker' && (
          <div style={{ marginBottom: '20px' }}>
            <p
              style={{
                margin: '0 0 10px 0',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1E3A5F',
              }}
            >
              Did you feel heard?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setFeltHeard(true)}
                style={{
                  flex: 1,
                  padding: '8px 20px',
                  backgroundColor: feltHeard === true ? '#2B7CF6' : 'white',
                  color: feltHeard === true ? 'white' : '#64748B',
                  border: `2px solid ${feltHeard === true ? '#2B7CF6' : '#E2E8F0'}`,
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (feltHeard !== true) {
                    e.currentTarget.style.borderColor = '#2B7CF6';
                  }
                }}
                onMouseOut={(e) => {
                  if (feltHeard !== true) {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFeltHeard(false)}
                style={{
                  flex: 1,
                  padding: '8px 20px',
                  backgroundColor: feltHeard === false ? '#2B7CF6' : 'white',
                  color: feltHeard === false ? 'white' : '#64748B',
                  border: `2px solid ${feltHeard === false ? '#2B7CF6' : '#E2E8F0'}`,
                  borderRadius: '24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  if (feltHeard !== false) {
                    e.currentTarget.style.borderColor = '#2B7CF6';
                  }
                }}
                onMouseOut={(e) => {
                  if (feltHeard !== false) {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }
                }}
              >
                No
              </button>
            </div>
          </div>
        )}

        {/* Would Recommend */}
        <div style={{ marginBottom: '20px' }}>
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1E3A5F',
            }}
          >
            Would you recommend Peerzle?
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setWouldRecommend(true)}
              style={{
                flex: 1,
                padding: '8px 20px',
                backgroundColor: wouldRecommend === true ? '#2B7CF6' : 'white',
                color: wouldRecommend === true ? 'white' : '#64748B',
                border: `2px solid ${wouldRecommend === true ? '#2B7CF6' : '#E2E8F0'}`,
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (wouldRecommend !== true) {
                  e.currentTarget.style.borderColor = '#2B7CF6';
                }
              }}
              onMouseOut={(e) => {
                if (wouldRecommend !== true) {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              style={{
                flex: 1,
                padding: '8px 20px',
                backgroundColor: wouldRecommend === false ? '#2B7CF6' : 'white',
                color: wouldRecommend === false ? 'white' : '#64748B',
                border: `2px solid ${wouldRecommend === false ? '#2B7CF6' : '#E2E8F0'}`,
                borderRadius: '24px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (wouldRecommend !== false) {
                  e.currentTarget.style.borderColor = '#2B7CF6';
                }
              }}
              onMouseOut={(e) => {
                if (wouldRecommend !== false) {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }
              }}
            >
              No
            </button>
          </div>
        </div>

        {/* Feedback Text */}
        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="feedback"
            style={{
              display: 'block',
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1E3A5F',
            }}
          >
            Any additional feedback? (optional)
          </label>
          <textarea
            id="feedback"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onFocus={() => setTextareaFocused(true)}
            onBlur={() => setTextareaFocused(false)}
            placeholder="Share your thoughts..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              backgroundColor: textareaFocused ? '#EDF4FF' : 'white',
              outline: 'none',
              transition: 'border-color 0.2s',
              borderColor: textareaFocused ? '#2B7CF6' : '#E2E8F0',
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#DC2626',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: isSubmitting || rating === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || rating === 0 ? 0.5 : 1,
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isSubmitting && rating !== 0) {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2B7CF6';
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
              marginTop: '12px',
              padding: '8px',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.color = '#2B7CF6';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#64748B';
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
