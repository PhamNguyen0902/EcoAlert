import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (data: { token: string; refreshToken: string; user: User }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    const storedRefreshToken = localStorage.getItem('refreshToken');

    let user = null;
    try {
      if (storedUser) user = JSON.parse(storedUser);
    } catch (e) {
      localStorage.removeItem('user');
    }

    return {
      user,
      token: storedToken || null,
      refreshToken: storedRefreshToken || null,
    };
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthState({ token: null, refreshToken: null, user: null });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = (data: { token: string; refreshToken: string; user: User }) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setAuthState({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    setAuthState({
      token: null,
      refreshToken: null,
      user: null,
    });
  };

  const contextValue: AuthContextType = {
    user: authState.user,
    token: authState.token,
    role: authState.user?.role || null,
    isAuthenticated: !!authState.token,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
