import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';
import { AxiosError } from 'axios';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      setIsSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
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
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img
              src="/peerzle-logo-vertical.svg"
              alt="Peerzle"
              style={{ width: '180px', height: 'auto' }}
            />
          </div>

          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                color: '#DC2626',
                backgroundColor: '#FEF2F2',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              Invalid reset link. Please request a new password reset.
            </div>
            <Link
              to="/forgot-password"
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
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          {isSuccess ? (
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
                    fontWeight: 500,
                  }}
                >
                  Password updated successfully!
                </p>
              </div>
              <p
                style={{
                  color: '#64748B',
                  fontSize: '14px',
                  marginBottom: '20px',
                }}
              >
                You can now sign in with your new password.
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
                Go to Login
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
                Set new password
              </h2>
              <p
                style={{
                  color: '#64748B',
                  fontSize: '14px',
                  marginBottom: '24px',
                }}
              >
                Enter your new password below.
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
                  {error.includes('invalid or has expired') && (
                    <div style={{ marginTop: '12px' }}>
                      <Link
                        to="/forgot-password"
                        style={{
                          color: '#DC2626',
                          fontWeight: 500,
                          textDecoration: 'underline',
                        }}
                      >
                        Request a new reset link
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label
                    htmlFor="newPassword"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 500,
                      color: '#1E3A5F',
                      fontSize: '14px',
                    }}
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
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
                  <p
                    style={{
                      color: '#94A3B8',
                      fontSize: '12px',
                      marginTop: '6px',
                      marginBottom: 0,
                    }}
                  >
                    Minimum 8 characters
                  </p>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label
                    htmlFor="confirmPassword"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 500,
                      color: '#1E3A5F',
                      fontSize: '14px',
                    }}
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
