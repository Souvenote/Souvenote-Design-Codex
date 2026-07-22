'use client';

import { AUTH_CSRF_HEADER } from './auth/constants';
import type { AuthIntent, CognitoSocialProvider } from './auth/types';

export type { CognitoSocialProvider } from './auth/types';

export type LocalUser = {
  id: string;
  cognito_user_id?: string | null;
  email: string;
  stripe_customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  birthday?: string | null;
  country?: string | null;
  currency?: string | null;
  language?: string | null;
  marketing_opt_in?: boolean | null;
  preferences?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type PublicAuthSession = {
  expiresAt: number;
  provider: 'cognito' | 'local';
};

export type BffSessionResponse = {
  authenticated: boolean;
  user: LocalUser | null;
  csrfToken: string | null;
  session?: PublicAuthSession;
};

export type HostedUiError = {
  code: string;
  message: string;
  provider?: CognitoSocialProvider;
};

export const AUTH_SESSION_UPDATED_EVENT = 'souv-auth-session-updated';

export class CognitoClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'CognitoClientError';
  }
}

async function readBffError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { code?: unknown; message?: unknown };
    const code = typeof payload.code === 'string' ? payload.code : 'BffAuthError';
    const message = typeof payload.message === 'string' ? payload.message : fallback;
    return new CognitoClientError(message, code);
  } catch {
    return new CognitoClientError(fallback, 'BffAuthError');
  }
}

export async function fetchBffSession(): Promise<BffSessionResponse> {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await readBffError(response, 'Could not restore your Souvenote session.');
  return (await response.json()) as BffSessionResponse;
}

export function startBffAuthorization({
  provider,
  returnTo = '/create',
  intent = 'login',
}: {
  provider?: CognitoSocialProvider;
  returnTo?: string;
  intent?: AuthIntent;
}) {
  const url = new URL('/api/auth/login', window.location.origin);
  url.searchParams.set('returnTo', returnTo);
  url.searchParams.set('intent', intent);
  if (provider) url.searchParams.set('provider', provider);
  window.location.assign(`${url.pathname}${url.search}`);
}

export async function logoutFromBff() {
  const current = await fetchBffSession();
  const headers = new Headers({ Accept: 'application/json' });
  if (current.csrfToken) headers.set(AUTH_CSRF_HEADER, current.csrfToken);
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
  });
  if (!response.ok) throw await readBffError(response, 'Could not sign out.');
  const payload = (await response.json()) as { logoutUrl?: unknown };
  window.dispatchEvent(new Event(AUTH_SESSION_UPDATED_EVENT));
  return typeof payload.logoutUrl === 'string' ? payload.logoutUrl : null;
}

export function consumeHostedUiError(): HostedUiError | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('authError');
  if (!code) return null;
  url.searchParams.delete('authError');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);

  const messages: Record<string, string> = {
    provider_error: 'The identity provider could not complete sign in. Please try again.',
    invalid_callback: 'The sign-in response could not be verified. Please start again.',
    invalid_transaction: 'The sign-in request expired or was already used. Please start again.',
    token_exchange_failed: 'The secure sign-in exchange failed. Please try again.',
    invalid_mode: 'Authentication is not available in this environment.',
  };
  return { code, message: messages[code] || 'Could not complete sign in.' };
}
