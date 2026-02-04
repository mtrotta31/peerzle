import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import { AxiosError } from 'axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/peerzle-logo-vertical.svg"
            alt="Peerzle"
            style={{ width: '180px', height: 'auto' }}
          />
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #E2E8F0',
          }}
        >
          {isSubmitted ? (
            <>
              <div
                style={{
                  backgroundColor: '#ECFDF5',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    color: '#065F46',
                    fontSize: '14px',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  If an account exists with that email, you'll receive a reset link shortly.
                </p>
              </div>
              <p
                style={{
                  color: '#64748B',
                  fontSize: '14px',
                  marginBottom: '20px',
                }}
              >
                Check your inbox and spam folder. The link will expire in 1 hour.
              </p>
              <Link
                to="/login"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: '#2B7CF6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  textAlign: 'center',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                }}
              >
                Back to Login
              </Link>
            </>
          ) : (
            <>
              <h2
                style={{
                  color: '#1E3A5F',
                  fontSize: '20px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  marginTop: 0,
                }}
              >
                Forgot your password?
              </h2>
              <p
                style={{
                  color: '#64748B',
                  fontSize: '14px',
                  marginBottom: '24px',
                }}
              >
                Enter your email and we'll send you a link to reset your password.
              </p>

              {error && (
                <div
                  style={{
                    color: '#DC2626',
                    backgroundColor: '#FEF2F2',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label
                    htmlFor="email"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 500,
                      color: '#1E3A5F',
                      fontSize: '14px',
                    }}
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#2B7CF6';
                      e.currentTarget.style.backgroundColor = '#EDF4FF';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    backgroundColor: '#2B7CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                    transition: 'background-color 0.2s, transform 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = '#1E6AD9';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#2B7CF6';
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Link
                  to="/login"
                  style={{
                    color: '#2B7CF6',
                    fontSize: '14px',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
