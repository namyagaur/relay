import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  API_KEY_STORAGE_KEY,
  request,
  setUnauthorizedHandler,
} from '@/services/api/client';

const AuthContext = createContext(null);

function readStoredApiKey() {
  try {
    return window.sessionStorage.getItem(API_KEY_STORAGE_KEY);
  } catch {
    throw new Error('Session storage is unavailable in this browser.');
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const expireSession = useCallback(() => {
    setProject(null);
    setIsAuthenticated(false);
    setAuthError('Your API key is invalid, expired, or revoked. Enter a valid key to continue.');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  useEffect(() => {
    let active = true;
    let storedApiKey;
    try {
      storedApiKey = readStoredApiKey();
    } catch (error) {
      setAuthError(error.message);
      setIsLoadingAuth(false);
      return () => {
        active = false;
      };
    }

    if (!storedApiKey) {
      setIsLoadingAuth(false);
      return () => {
        active = false;
      };
    }

    request('/auth/session')
      .then((session) => {
        if (!active) return;
        setProject(session.project);
        setIsAuthenticated(true);
        setAuthError(null);
      })
      .catch((error) => {
        if (!active) return;
        setAuthError(error.message);
      })
      .finally(() => {
        if (active) setIsLoadingAuth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(async (apiKey) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const session = await request('/auth/session', { apiKey: apiKey.trim() });
      try {
        window.sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
      } catch {
        throw new Error('Unable to save the API key for this browser session.');
      }
      setProject(session.project);
      setIsAuthenticated(true);
      return session.project;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      throw new Error('Unable to clear the API key from this browser session.');
    }
    queryClient.clear();
    setProject(null);
    setIsAuthenticated(false);
    setAuthError(null);
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{ project, isAuthenticated, isLoadingAuth, authError, authenticate, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
