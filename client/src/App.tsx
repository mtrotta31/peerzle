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
import HelperPage from './pages/HelperPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminStats from './pages/AdminStats';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import HelperTraining from './pages/HelperTraining';
import ChatPage from './pages/ChatPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';
import OnboardingFlow from './pages/OnboardingFlow';
import SuperAdminPanel from './pages/SuperAdminPanel';
import CommunityManagement from './pages/CommunityManagement';
import SettingsPage from './pages/SettingsPage';
import MoodCheckInPage from './pages/MoodCheckInPage';
import MoodHistoryPage from './pages/MoodHistoryPage';
import MessagesPage from './pages/MessagesPage';
import CommunityLayout from './components/CommunityLayout';
import DemoRedirect from './pages/DemoRedirect';

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

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isSuperAdmin) {
    return <Navigate to="/communities" replace />;
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

      {/* Demo route - handles auth internally and auto-joins demo community */}
      <Route path="/demo" element={<DemoRedirect />} />

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
            <CommunityLayout>
              <CommunityDashboard />
            </CommunityLayout>
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
        path="/community/:slug/messages"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <MessagesPage />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/history"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <SessionHistory />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/helper"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <HelperPage />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/helper-dashboard"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <HelperDashboard />
            </CommunityLayout>
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
        path="/community/:slug/admin/stats"
        element={
          <ProtectedRoute>
            <AdminStats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/org/:orgSlug/admin"
        element={
          <ProtectedRoute>
            <OrgAdminDashboard />
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
        path="/community/:slug/check-in"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <MoodCheckInPage />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/mood-checkin"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <MoodCheckInPage />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/mood-history"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <MoodHistoryPage />
            </CommunityLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/community/:slug/settings"
        element={
          <ProtectedRoute>
            <CommunityLayout>
              <SettingsPage />
            </CommunityLayout>
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
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Super Admin routes */}
      <Route
        path="/super-admin"
        element={
          <SuperAdminRoute>
            <SuperAdminPanel />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super-admin/community/:slug"
        element={
          <SuperAdminRoute>
            <CommunityManagement />
          </SuperAdminRoute>
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
