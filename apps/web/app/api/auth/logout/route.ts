import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError, assertSameOriginMutation } from '../../../lib/auth/backend';
import { AUTH_CSRF_HEADER } from '../../../lib/auth/constants';
import { getBffConfig } from '../../../lib/auth/config';
import { buildCognitoLogoutUrl } from '../../../lib/auth/cognito';
import { safeEquals } from '../../../lib/auth/security';
import { clearAuthCookies, getActiveAccessSession } from '../../../lib/auth/session';

export async function POST(request: Request) {
  const store = await cookies();
  const session = await getActiveAccessSession(store);
  if (session) {
    try {
      assertSameOriginMutation(request);
    } catch (error) {
      if (error instanceof NextResponse) return error;
      throw error;
    }
    const csrf = request.headers.get(AUTH_CSRF_HEADER);
    if (!csrf || !safeEquals(csrf, session.csrfToken)) {
      return apiError(403, 'CSRF_VALIDATION_FAILED', 'The request could not be verified.');
    }
  }

  const config = getBffConfig();
  clearAuthCookies(store);
  const logoutUrl =
    session?.provider === 'cognito' && config.authMode === 'cognito' && config.cognito
      ? buildCognitoLogoutUrl(config.cognito)
      : null;
  return NextResponse.json({ loggedOut: true, logoutUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
