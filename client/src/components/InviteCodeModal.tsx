import { useState } from 'react';

interface InviteCodeModalProps {
  communityName: string;
  onSubmit: (code: string) => Promise<void>;
  onClose: () => void;
  error?: string | null;
}

export default function InviteCodeModal({ communityName, onSubmit, onClose, error }: InviteCodeModalProps) {
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(code.trim().toUpperCase());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric, convert to uppercase
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setCode(value);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '400px',
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
          Enter Invite Code
        </h2>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: '#64748B',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {communityName} requires an invite code from your organization
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="XXXXXXXX"
            maxLength={12}
            autoFocus
            style={{
              width: '100%',
              padding: '16px',
              border: error ? '2px solid #DC2626' : '1px solid #E2E8F0',
              borderRadius: '12px',
              fontSize: '20px',
              fontFamily: 'monospace',
              textAlign: 'center',
              letterSpacing: '4px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s, background-color 0.2s',
              backgroundColor: error ? '#FEF2F2' : 'white',
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = '#2B7CF6';
                e.currentTarget.style.backgroundColor = '#EDF4FF';
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          />

          {error && (
            <p
              style={{
                margin: '12px 0 0 0',
                fontSize: '14px',
                color: '#DC2626',
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!code.trim() || isSubmitting}
            style={{
              width: '100%',
              padding: '14px',
              marginTop: '24px',
              backgroundColor: '#2B7CF6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: !code.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              opacity: !code.trim() || isSubmitting ? 0.5 : 1,
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (code.trim() && !isSubmitting) {
                e.currentTarget.style.backgroundColor = '#1E6AD9';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2B7CF6';
            }}
          >
            {isSubmitting ? 'Joining...' : 'Join Community'}
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
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
