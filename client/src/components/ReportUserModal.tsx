import { useState } from 'react';
import { submitReport } from '../services/api';

interface ReportUserModalProps {
  conversationId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const CATEGORIES = [
  { value: 'inappropriate_behavior', label: 'Inappropriate Behavior', description: 'Rude, hostile, or disrespectful conduct' },
  { value: 'harmful_content', label: 'Harmful Content', description: 'Content that could cause harm to others' },
  { value: 'spam', label: 'Spam', description: 'Irrelevant or promotional messages' },
  { value: 'crisis_concerns', label: 'Crisis Concerns', description: 'Concern for the other person\'s safety' },
  { value: 'other', label: 'Other', description: 'Something else not listed above' },
];

export default function ReportUserModal({ conversationId, onClose, onSubmitted }: ReportUserModalProps) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const handleSubmit = async () => {
    if (!category) {
      setError('Please select a category');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await submitReport(conversationId, category, description.trim() || undefined);
      onSubmitted();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      if (axiosError.response?.data?.error === 'You have already submitted a report for this conversation') {
        setError('You have already submitted a report for this conversation.');
      } else {
        setError('Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
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
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        }}
      >
        {step === 'form' ? (
          <>
            {/* Header */}
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                  Report User
                </h2>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748B' }}>
                Your report will be reviewed by a community administrator. Your identity will remain anonymous to the reported user.
              </p>
            </div>

            {/* Category Selection */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#1E3A5F' }}>
                What would you like to report?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { setCategory(cat.value); setError(''); }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: category === cat.value ? '2px solid #2B7CF6' : '1px solid #E2E8F0',
                      backgroundColor: category === cat.value ? '#EDF4FF' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: category === cat.value ? '#2B7CF6' : '#1E3A5F',
                    }}>
                      {cat.label}
                    </p>
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: '13px',
                      color: '#64748B',
                    }}>
                      {cat.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '0 24px 20px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1E3A5F' }}>
                Additional details (optional)
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any additional context..."
                maxLength={500}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px 14px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  fontSize: '14px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2B7CF6'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
              />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94A3B8', textAlign: 'right' }}>
                {description.length}/500
              </p>
            </div>

            {error && (
              <div style={{ padding: '0 24px 16px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#DC2626' }}>{error}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{
              padding: '16px 24px 24px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#94A3B8'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!category) {
                    setError('Please select a category');
                    return;
                  }
                  setStep('confirm');
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Confirm Step */}
            <div style={{ padding: '24px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 600, color: '#1E3A5F' }}>
                Confirm Report
              </h2>
              <div style={{
                backgroundColor: '#FEF2F2',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
              }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#1E3A5F' }}>
                  <strong>Category:</strong>{' '}
                  {CATEGORIES.find((c) => c.value === category)?.label}
                </p>
                {description.trim() && (
                  <p style={{ margin: 0, fontSize: '14px', color: '#1E3A5F' }}>
                    <strong>Details:</strong> {description.trim()}
                  </p>
                )}
              </div>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748B' }}>
                This report will be sent to the community administrators for review. Are you sure you want to submit?
              </p>

              {error && (
                <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#DC2626' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setStep('form')}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#64748B',
                    border: '1px solid #E2E8F0',
                    borderRadius: '24px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#DC2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!isSubmitting) e.currentTarget.style.backgroundColor = '#B91C1C';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#DC2626';
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
