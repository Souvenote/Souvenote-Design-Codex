"use client";

import * as React from "react";
import { fetchAuthenticatedUser } from "../lib/api";
import {
  AUTH_SESSION_UPDATED_EVENT,
  clearCognitoAuthState,
  completeHostedUiSignIn,
  confirmCognitoPasswordReset,
  confirmCognitoSignUp,
  consumeHostedUiAttempt,
  consumeHostedUiReturnTo,
  getActiveCognitoSession,
  getHostedUiLogoutUrl,
  getStoredLocalUser,
  rememberHostedUiError,
  requestCognitoPasswordReset,
  signInWithCognito,
  signUpWithCognito,
  startHostedUiSignIn,
  storeLocalUser,
} from "../lib/cognitoAuth";
import type { CognitoCodeDelivery, CognitoSession, CognitoSocialProvider, LocalUser } from "../lib/cognitoAuth";
import type { DemoUser } from "./DemoUser";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type SignUpResponse = {
  needsConfirmation: boolean;
  codeDelivery?: CognitoCodeDelivery;
  user?: LocalUser;
};

type AuthContextValue = {
  status: AuthStatus;
  session: CognitoSession | null;
  user: LocalUser | null;
  displayUser: DemoUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<LocalUser>;
  signup: (email: string, password: string) => Promise<SignUpResponse>;
  confirmSignup: (email: string, confirmationCode: string, password: string) => Promise<LocalUser>;
  requestPasswordReset: (email: string) => Promise<CognitoCodeDelivery | undefined>;
  confirmPasswordReset: (email: string, confirmationCode: string, newPassword: string) => Promise<void>;
  startSocialSignIn: (provider: CognitoSocialProvider, returnTo?: string) => Promise<void>;
  logout: (options?: { hostedUi?: boolean }) => boolean;
  refreshUser: () => Promise<LocalUser | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function initialsForEmail(email: string) {
  const namePart = email.split("@")[0] || "U";
  const pieces = namePart.split(/[._-]+/).filter(Boolean);
  const initials = pieces.length > 1
    ? `${pieces[0][0]}${pieces[1][0]}`
    : namePart.slice(0, 2);

  return initials.toUpperCase();
}

function displayNameForEmail(email: string) {
  const namePart = email.split("@")[0] || "Souvenote User";
  return namePart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((piece) => `${piece.charAt(0).toUpperCase()}${piece.slice(1)}`)
    .join(" ") || email;
}

function displayNameForSession(session: CognitoSession | null, email: string) {
  const sessionName = session?.name?.trim()
    || [session?.givenName, session?.familyName].filter(Boolean).join(" ").trim();

  return sessionName || displayNameForEmail(email);
}

function errorMessageFromUnknown(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toDisplayUser(user: LocalUser | null, session: CognitoSession | null): DemoUser | null {
  if (!user) return null;
  const profileName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const name = profileName || displayNameForSession(session, user.email);
  return {
    name,
    email: user.email,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((piece) => piece[0])
      .join("")
      .toUpperCase() || initialsForEmail(user.email),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [session, setSession] = React.useState<CognitoSession | null>(null);
  const [user, setUser] = React.useState<LocalUser | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const syncLocalUser = React.useCallback(async (nextSession: CognitoSession) => {
    setSession(nextSession);
    setUser(null);
    setStatus("loading");
    setError(null);

    try {
      const localUser = await fetchAuthenticatedUser();
      storeLocalUser(localUser);
      setUser(localUser);
      setStatus("authenticated");
      return localUser;
    } catch (unknownError) {
      clearCognitoAuthState();
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
      setError(errorMessageFromUnknown(unknownError, "Could not sync your Souvenote account."));
      throw unknownError;
    }
  }, []);

  const refreshUser = React.useCallback(async () => {
    const activeSession = await getActiveCognitoSession();
    if (!activeSession) {
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
      return null;
    }

    return syncLocalUser(activeSession);
  }, [syncLocalUser]);

  React.useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const cachedUser = getStoredLocalUser();
      if (cachedUser) setUser(cachedUser);

      try {
        const hostedUiSession = await completeHostedUiSignIn();
        const activeSession = hostedUiSession || await getActiveCognitoSession();
        if (cancelled) return;

        if (!activeSession) {
          setStatus("unauthenticated");
          setSession(null);
          setUser(null);
          return;
        }

        try {
          await syncLocalUser(activeSession);
        } catch (unknownError) {
          if (hostedUiSession) {
            const attempt = consumeHostedUiAttempt();
            rememberHostedUiError({
              code: "HostedUiAccountSyncError",
              message: errorMessageFromUnknown(unknownError, "Could not connect that social login to your Souvenote account."),
              provider: attempt?.provider,
            });

            const authPath = attempt?.authPath || "/login";
            if (`${window.location.pathname}${window.location.search}` !== authPath) {
              window.location.replace(authPath);
            }
          }

          throw unknownError;
        }

        const returnTo = hostedUiSession ? consumeHostedUiReturnTo() : null;
        if (returnTo && window.location.pathname !== returnTo) {
          window.location.replace(returnTo);
        }
      } catch (unknownError) {
        if (cancelled) return;
        clearCognitoAuthState();
        setSession(null);
        setUser(null);
        setStatus("unauthenticated");
        setError(unknownError instanceof Error ? unknownError.message : "Could not restore your session.");
      }
    }

    restoreSession();

    function onAuthUpdate() {
      if (!getStoredLocalUser()) setUser(null);
    }

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthUpdate);
    };
  }, [syncLocalUser]);

  const login = React.useCallback(async (email: string, password: string) => {
    setStatus("loading");
    setError(null);
    try {
      const nextSession = await signInWithCognito(email, password);
      return await syncLocalUser(nextSession);
    } catch (unknownError) {
      setStatus("unauthenticated");
      setError(errorMessageFromUnknown(unknownError, "Could not sign in."));
      throw unknownError;
    }
  }, [syncLocalUser]);

  const syncSignupThenSignOut = React.useCallback(async (email: string, password: string) => {
    const nextSession = await signInWithCognito(email, password);
    try {
      return await syncLocalUser(nextSession);
    } finally {
      clearCognitoAuthState();
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [syncLocalUser]);

  const signup = React.useCallback(async (email: string, password: string): Promise<SignUpResponse> => {
    setStatus("loading");
    setError(null);
    let result: Awaited<ReturnType<typeof signUpWithCognito>>;

    try {
      result = await signUpWithCognito(email, password);
    } catch (unknownError) {
      setStatus("unauthenticated");
      setError(errorMessageFromUnknown(unknownError, "Could not create your account."));
      throw unknownError;
    }

    if (!result.confirmed) {
      setStatus("unauthenticated");
      return {
        needsConfirmation: true,
        codeDelivery: result.codeDelivery,
      };
    }

    const localUser = await syncSignupThenSignOut(email, password);
    return {
      needsConfirmation: false,
      user: localUser,
    };
  }, [syncSignupThenSignOut]);

  const confirmSignup = React.useCallback(async (email: string, confirmationCode: string, password: string) => {
    setStatus("loading");
    setError(null);
    try {
      await confirmCognitoSignUp(email, confirmationCode);
      return await syncSignupThenSignOut(email, password);
    } catch (unknownError) {
      setStatus("unauthenticated");
      setError(errorMessageFromUnknown(unknownError, "Could not confirm your account."));
      throw unknownError;
    }
  }, [syncSignupThenSignOut]);

  const requestPasswordReset = React.useCallback(async (email: string) => {
    setError(null);
    return requestCognitoPasswordReset(email);
  }, []);

  const confirmPasswordReset = React.useCallback(async (
    email: string,
    confirmationCode: string,
    newPassword: string,
  ) => {
    setError(null);
    await confirmCognitoPasswordReset(email, confirmationCode, newPassword);
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const startSocialSignIn = React.useCallback(async (provider: CognitoSocialProvider, returnTo = "/create") => {
    setStatus("loading");
    setError(null);
    try {
      await startHostedUiSignIn(provider, returnTo);
    } catch (unknownError) {
      setStatus("unauthenticated");
      setError(errorMessageFromUnknown(unknownError, "Could not start social sign in."));
      throw unknownError;
    }
  }, []);

  const logout = React.useCallback((options: { hostedUi?: boolean } = {}) => {
    let hostedUiLogoutUrl: string | null = null;
    if (options.hostedUi) {
      try {
        hostedUiLogoutUrl = getHostedUiLogoutUrl();
      } catch {
        hostedUiLogoutUrl = null;
      }
    }

    clearCognitoAuthState();
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
    setError(null);

    if (hostedUiLogoutUrl) {
      window.location.assign(hostedUiLogoutUrl);
      return true;
    }

    return false;
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({
    status,
    session,
    user,
    displayUser: toDisplayUser(user, session),
    error,
    login,
    signup,
    confirmSignup,
    requestPasswordReset,
    confirmPasswordReset,
    startSocialSignIn,
    logout,
    refreshUser,
  }), [confirmPasswordReset, confirmSignup, error, login, logout, refreshUser, requestPasswordReset, session, signup, startSocialSignIn, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = React.useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
