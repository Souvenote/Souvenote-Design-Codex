import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/auth/backend';
import {
  cleanReturnTo,
  getBffConfig,
  isLoopbackHostname,
  resolveLoopbackRequestOrigin,
} from '../../../lib/auth/config';
import { buildCognitoAuthorizationUrl } from '../../../lib/auth/cognito';
import { randomBase64Url } from '../../../lib/auth/security';
import { createAuthTransaction, establishLocalSession } from '../../../lib/auth/session';
import type { AuthIntent, CognitoSocialProvider } from '../../../lib/auth/types';

const SOCIAL_PROVIDERS = new Set<CognitoSocialProvider>(['Google', 'Facebook', 'SignInWithApple']);

export async function GET(request: Request) {
  try {
    const config = getBffConfig();
    const store = await cookies();
    const url = new URL(request.url);
    const returnTo = cleanReturnTo(url.searchParams.get('returnTo'), '/create');
    const intent: AuthIntent = url.searchParams.get('intent') === 'signup' ? 'signup' : 'login';
    const requestedProvider = url.searchParams.get('provider');
    const provider = SOCIAL_PROVIDERS.has(requestedProvider as CognitoSocialProvider)
      ? (requestedProvider as CognitoSocialProvider)
      : undefined;

    if (config.authMode === 'local') {
      if (!isLoopbackHostname(url.hostname)) {
        return apiError(403, 'LOCAL_AUTH_LOOPBACK_REQUIRED', 'Local authentication is available only on loopback.');
      }
      const requestOrigin = resolveLoopbackRequestOrigin(request);
      establishLocalSession(store);
      return NextResponse.redirect(new URL(returnTo, requestOrigin), { status: 303 });
    }
    if (!config.cognito) return apiError(500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is unavailable.');

    const authPath = intent === 'signup' ? '/signup' : '/login';
    const transaction = {
      state: randomBase64Url(),
      nonce: randomBase64Url(),
      verifier: randomBase64Url(64),
      returnTo,
      authPath,
      provider,
      createdAt: Date.now(),
    };
    createAuthTransaction(store, transaction);
    return NextResponse.redirect(buildCognitoAuthorizationUrl(config.cognito, transaction, intent, provider));
  } catch {
    return apiError(500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is unavailable.');
  }
}
