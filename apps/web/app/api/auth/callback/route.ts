import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/auth/backend';
import { getBffConfig } from '../../../lib/auth/config';
import { exchangeCognitoCode } from '../../../lib/auth/cognito';
import { isSafeAuthorizationCode, isSafeOAuthState, safeEquals } from '../../../lib/auth/security';
import { consumeAuthTransaction, establishCognitoSession } from '../../../lib/auth/session';

function authFailureRedirect(request: Request, authPath: string, code: string) {
  const target = new URL(authPath, request.url);
  target.searchParams.set('authError', code);
  return NextResponse.redirect(target, { status: 303 });
}

export async function GET(request: Request) {
  const store = await cookies();
  let transaction;
  try {
    transaction = consumeAuthTransaction(store);
  } catch {
    return apiError(500, 'AUTH_CONFIGURATION_ERROR', 'Authentication is unavailable.');
  }
  if (!transaction) return authFailureRedirect(request, '/login', 'invalid_transaction');

  const url = new URL(request.url);
  if (url.searchParams.has('error')) return authFailureRedirect(request, transaction.authPath, 'provider_error');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!isSafeAuthorizationCode(code) || !isSafeOAuthState(state) || !safeEquals(state, transaction.state)) {
    return authFailureRedirect(request, transaction.authPath, 'invalid_callback');
  }

  try {
    const config = getBffConfig();
    if (config.authMode !== 'cognito' || !config.cognito) {
      return authFailureRedirect(request, transaction.authPath, 'invalid_mode');
    }
    const tokens = await exchangeCognitoCode(config.cognito, code, transaction);
    establishCognitoSession(store, tokens);
    return NextResponse.redirect(new URL(transaction.returnTo, request.url), { status: 303 });
  } catch {
    return authFailureRedirect(request, transaction.authPath, 'token_exchange_failed');
  }
}
