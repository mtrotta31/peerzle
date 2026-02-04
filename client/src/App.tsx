import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getAcceptanceStatus } from './services/api';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDashboard from './pages/CommunityDashboard';
import SessionHistory from './pages/SessionHistory';
import HelperDashboard from './pages/HelperDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HelperTraining from './pages/HelperTraining';
import ChatPage from './pages/ChatPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';
import OnboardingFlow from './pages/OnboardingFlow';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checkingTerms, setCheckingTerms] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      getAcceptanceStatus()
        .then((status) => {
          setTermsAccepted(status.accepted);
          setCurrentVersion(status.currentVersion);
        })
        .catch(() => {
          // If we can't check, assume accepted to not block the user
          setTermsAccepted(true);
        })
        .finally(() => {
          setCheckingTerms(false);
        });
    } else {
      setCheckingTerms(false);
    }
  }, [isAuthenticated]);

  if (isLoading || checkingTerms) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show terms acceptance modal if terms not accepted
  if (termsAccepted === false) {
    return (
      <>
        {children}
        <TermsAcceptanceModal
          currentVersion={currentVersion}
          onAccepted={() => setTermsAccepted(true)}
        />
      </>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <Routes>
      {/* Redirect root to communities */}
      <Route path="/" element={<Navigate to="/communities" replace />} />

      {/* Auth routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/communities" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/communities" replace /> : <SignupPage />}
      />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/communities" replace /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/communities" replace /> : <ResetPassword />}
      />

      {/* Public legal routes */}
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* Protected routes */}
      <Route
        path="/communities"
        element={
          <ProtectedRoute>
            <CommunitiesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug"
        element={
          <ProtectedRoute>
            <CommunityDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingFlow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/history"
        element={
          <ProtectedRoute>
            <SessionHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/helper-dashboard"
        element={
          <ProtectedRoute>
            <HelperDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/training"
        element={
          <ProtectedRoute>
            <HelperTraining />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:conversationId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
