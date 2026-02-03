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
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '24px',
            fontWeight: 600,
            color: '#1f2937',
            textAlign: 'center',
          }}
        >
          How was your session?
        </h2>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#6b7280',
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
                fontSize: '36px',
                color: star <= displayRating ? '#fbbf24' : '#d1d5db',
                transition: 'color 0.15s ease, transform 0.15s ease',
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
                fontSize: '15px',
                fontWeight: 500,
                color: '#374151',
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
                  padding: '10px 16px',
                  backgroundColor: feltHeard === true ? '#059669' : '#f3f4f6',
                  color: feltHeard === true ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFeltHeard(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: feltHeard === false ? '#dc2626' : '#f3f4f6',
                  color: feltHeard === false ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
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
              fontSize: '15px',
              fontWeight: 500,
              color: '#374151',
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
                padding: '10px 16px',
                backgroundColor: wouldRecommend === true ? '#059669' : '#f3f4f6',
                color: wouldRecommend === true ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setWouldRecommend(false)}
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: wouldRecommend === false ? '#dc2626' : '#f3f4f6',
                color: wouldRecommend === false ? 'white' : '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
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
              fontSize: '15px',
              fontWeight: 500,
              color: '#374151',
            }}
          >
            Any additional feedback? (optional)
          </label>
          <textarea
            id="feedback"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#dc2626',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: 'white',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: '#1a365d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: isSubmitting || rating === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || rating === 0 ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
