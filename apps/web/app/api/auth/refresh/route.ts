import { NextResponse } from 'next/server';
import { AUTH_CSRF_HEADER } from '../../../lib/auth/constants';
import { apiError, assertSameOriginMutation, fetchCurrentUser } from '../../../lib/auth/backend';
import { safeEquals } from '../../../lib/auth/security';
import { getActiveAccessSession } from '../../../lib/auth/session';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    throw error;
  }
  const session = await getActiveAccessSession();
  if (!session) return apiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  const csrf = request.headers.get(AUTH_CSRF_HEADER);
  if (!csrf || !safeEquals(csrf, session.csrfToken)) {
    return apiError(403, 'CSRF_VALIDATION_FAILED', 'The request could not be verified.');
  }
  const user = await fetchCurrentUser(session);
  if (!user) return apiError(502, 'ACCOUNT_SYNC_UNAVAILABLE', 'The account could not be loaded.');
  return NextResponse.json(
    {
      authenticated: true,
      user,
      csrfToken: session.csrfToken,
      session: { expiresAt: session.expiresAt, provider: session.provider },
    },
    { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } },
  );
}
