import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(returnTo || '/communities');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Login failed');
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
          <p
            style={{
              marginTop: '12px',
              color: '#64748B',
              fontSize: '16px',
            }}
          >
            Peer support, when you need it
          </p>
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

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 500,
                  color: '#1E3A5F',
                  fontSize: '14px',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            <div style={{ marginBottom: '24px', textAlign: 'right' }}>
              <Link
                to="/forgot-password"
                style={{
                  color: '#2B7CF6',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </Link>
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
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '16px' }}>
            <Link
              to="/signup"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 24px',
                backgroundColor: 'white',
                color: '#2B7CF6',
                border: '2px solid #2B7CF6',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                boxSizing: 'border-box',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#EDF4FF';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Create Account
            </Link>
          </div>
        </div>

        <p
          style={{
            marginTop: '24px',
            textAlign: 'center',
            color: '#64748B',
            fontSize: '14px',
          }}
        >
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#2B7CF6', fontWeight: 500 }}>
            Sign up
          </Link>
        </p>

        {/* Footer Links */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
          }}
        >
          <Link
            to="/terms"
            style={{
              color: '#64748B',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            Terms of Service
          </Link>
          <Link
            to="/privacy"
            style={{
              color: '#64748B',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
