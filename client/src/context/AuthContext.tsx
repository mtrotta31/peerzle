import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, login as apiLogin, signup as apiSignup, getCurrentUser } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpiredMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, acceptedTermsVersion: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  clearSessionExpiredMessage: () => void;
  updateUserProfile: (firstName: string, lastName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getCurrentUser()
        .then((user) => {
          setUser(user);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // Listen for session expiration events from API interceptor
  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent<{ reason: string }>) => {
      setUser(null);
      setSessionExpiredMessage(event.detail.reason + '. Please log in again.');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired as EventListener);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired as EventListener);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    localStorage.setItem('token', response.token);
    setUser(response.user);
  };

  const signup = async (email: string, password: string, acceptedTermsVersion: string, firstName: string, lastName: string) => {
    const response = await apiSignup(email, password, acceptedTermsVersion, firstName, lastName);
    localStorage.setItem('token', response.token);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUserProfile = (firstName: string, lastName: string) => {
    if (user) {
      setUser({ ...user, firstName, lastName, needsProfileUpdate: false });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        sessionExpiredMessage,
        login,
        signup,
        logout,
        clearSessionExpiredMessage,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
