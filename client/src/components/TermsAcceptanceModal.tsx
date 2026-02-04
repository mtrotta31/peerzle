import { useState } from 'react';
import { acceptTerms } from '../services/api';

interface TermsAcceptanceModalProps {
  currentVersion: string;
  onAccepted: () => void;
}

export default function TermsAcceptanceModal({ currentVersion, onAccepted }: TermsAcceptanceModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!accepted || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await acceptTerms(currentVersion);
      onAccepted();
    } catch {
      setError('Failed to accept terms. Please try again.');
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/peerzle-logo-vertical.svg"
            alt="Peerzle"
            style={{ width: '100px', height: 'auto' }}
          />
        </div>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 16px 0',
            fontSize: '22px',
            fontWeight: 600,
            color: '#1E3A5F',
            textAlign: 'center',
          }}
        >
          Updated Terms of Service
        </h2>

        {/* Description */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '15px',
            color: '#64748B',
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          Please review and accept our Terms of Service and Privacy Policy to continue using Peerzle.
        </p>

        {/* Links */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            marginBottom: '28px',
          }}
        >
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#2B7CF6',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              padding: '10px 20px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#2B7CF6',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              padding: '10px 20px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Privacy Policy
          </a>
        </div>

        {/* Checkbox */}
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#1E3A5F',
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                accentColor: '#2B7CF6',
              }}
            />
            <span>
              I have read and agree to the Terms of Service and Privacy Policy
            </span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              borderRadius: '8px',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!accepted || isSubmitting}
          style={{
            width: '100%',
            padding: '16px 24px',
            backgroundColor: accepted ? '#2B7CF6' : '#94A3B8',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: accepted && !isSubmitting ? 'pointer' : 'not-allowed',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => {
            if (accepted && !isSubmitting) {
              e.currentTarget.style.backgroundColor = '#1E6AD9';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = accepted ? '#2B7CF6' : '#94A3B8';
          }}
        >
          {isSubmitting ? 'Please wait...' : 'Continue'}
        </button>

        {/* Version info */}
        <p
          style={{
            marginTop: '16px',
            fontSize: '12px',
            color: '#94A3B8',
            textAlign: 'center',
          }}
        >
          Terms version {currentVersion}
        </p>
      </div>
    </div>
  );
}
