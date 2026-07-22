'use client';

import * as React from 'react';
import {
  AUTH_SESSION_UPDATED_EVENT,
  fetchBffSession,
  logoutFromBff,
  startBffAuthorization,
  type LocalUser,
  type PublicAuthSession,
  type CognitoSocialProvider,
} from '../lib/cognitoAuth';
import type { DemoUser } from './DemoUser';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
type CodeDelivery = { destination?: string; deliveryMedium?: string; attributeName?: string };
type SignUpResponse = { needsConfirmation: boolean; codeDelivery?: CodeDelivery; user?: LocalUser };

type AuthContextValue = {
  status: AuthStatus;
  session: PublicAuthSession | null;
  user: LocalUser | null;
  displayUser: DemoUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<LocalUser>;
  signup: (email: string, password: string) => Promise<SignUpResponse>;
  confirmSignup: (email: string, confirmationCode: string, password: string) => Promise<LocalUser>;
  startSocialSignIn: (provider: CognitoSocialProvider, returnTo?: string) => Promise<void>;
  logout: (options?: { hostedUi?: boolean }) => Promise<boolean>;
  refreshUser: () => Promise<LocalUser | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function displayUser(user: LocalUser | null): DemoUser | null {
  if (!user) return null;
  const emailName = user.email.split('@')[0] || 'Souvenote User';
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
    emailName
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  return {
    name,
    email: user.email,
    initials:
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'SU',
  };
}

function navigationPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [session, setSession] = React.useState<PublicAuthSession | null>(null);
  const [user, setUser] = React.useState<LocalUser | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refreshUser = React.useCallback(async () => {
    try {
      const restored = await fetchBffSession();
      setSession(restored.session ?? null);
      setUser(restored.user);
      setStatus(restored.authenticated ? 'authenticated' : 'unauthenticated');
      setError(null);
      return restored.user;
    } catch (unknownError) {
      setSession(null);
      setUser(null);
      setStatus('error');
      setError(unknownError instanceof Error ? unknownError.message : 'Could not restore your session.');
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refreshUser();
    const onUpdate = () => void refreshUser();
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onUpdate);
  }, [refreshUser]);

  const login = React.useCallback(async (_email: string, _password: string) => {
    setStatus('loading');
    startBffAuthorization({ intent: 'login', returnTo: '/create' });
    return navigationPromise<LocalUser>();
  }, []);

  const signup = React.useCallback(async (_email: string, _password: string) => {
    setStatus('loading');
    startBffAuthorization({ intent: 'signup', returnTo: '/welcome' });
    return navigationPromise<SignUpResponse>();
  }, []);

  const confirmSignup = React.useCallback(async (_email: string, _code: string, _password: string) => {
    setStatus('loading');
    startBffAuthorization({ intent: 'login', returnTo: '/welcome' });
    return navigationPromise<LocalUser>();
  }, []);

  const startSocialSignIn = React.useCallback(async (provider: CognitoSocialProvider, returnTo = '/create') => {
    setStatus('loading');
    startBffAuthorization({ provider, returnTo, intent: 'login' });
  }, []);

  const logout = React.useCallback(async (_options: { hostedUi?: boolean } = {}) => {
    const logoutUrl = await logoutFromBff();
    setSession(null);
    setUser(null);
    setStatus('unauthenticated');
    setError(null);
    if (logoutUrl) {
      window.location.assign(logoutUrl);
      return true;
    }
    return false;
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user,
      displayUser: displayUser(user),
      error,
      login,
      signup,
      confirmSignup,
      startSocialSignIn,
      logout,
      refreshUser,
    }),
    [confirmSignup, error, login, logout, refreshUser, session, signup, startSocialSignIn, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
