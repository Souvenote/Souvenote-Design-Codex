import { NextResponse } from 'next/server';
import { fetchCurrentUser } from '../../../lib/auth/backend';
import { getActiveAccessSession } from '../../../lib/auth/session';

export async function GET() {
  const session = await getActiveAccessSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false, user: null, csrfToken: null },
      { headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } },
    );
  }

  const user = await fetchCurrentUser(session);
  if (!user) {
    return NextResponse.json(
      { code: 'ACCOUNT_SYNC_UNAVAILABLE', message: 'The account could not be loaded.', requestId: crypto.randomUUID() },
      { status: 502, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } },
    );
  }

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
