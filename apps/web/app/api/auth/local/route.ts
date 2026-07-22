import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError, assertSameOriginMutation, fetchCurrentUser } from '../../../lib/auth/backend';
import { getBffConfig } from '../../../lib/auth/config';
import { establishLocalSession } from '../../../lib/auth/session';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const config = getBffConfig();
    if (config.authMode !== 'local') return apiError(404, 'NOT_FOUND', 'Route not found.');
    const store = await cookies();
    const session = establishLocalSession(store);
    const user = await fetchCurrentUser(session);
    if (!user) return apiError(502, 'ACCOUNT_SYNC_UNAVAILABLE', 'The local account could not be loaded.');
    return NextResponse.json(
      {
        authenticated: true,
        user,
        csrfToken: session.csrfToken,
        session: { expiresAt: session.expiresAt, provider: session.provider },
      },
      { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } },
    );
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return apiError(500, 'AUTH_CONFIGURATION_ERROR', 'Local authentication is unavailable.');
  }
}
