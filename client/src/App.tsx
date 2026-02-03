import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CommunitiesPage from './pages/CommunitiesPage';
import CommunityDashboard from './pages/CommunityDashboard';
import SessionHistory from './pages/SessionHistory';
import HelperDashboard from './pages/HelperDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ChatPage from './pages/ChatPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
