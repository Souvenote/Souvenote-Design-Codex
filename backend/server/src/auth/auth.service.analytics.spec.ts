import { AnalyticsService } from '../analytics/analytics.service';
import { CreditsService } from '../credits/credits.service';
import { DatabaseService } from '../database/database.service';
import { AuthService } from './auth.service';
import type { CognitoJwtClaims } from './auth.types';

describe('AuthService analytics', () => {
  const query = jest.fn();
  const grantOnce = jest.fn();
  const accountProvisioned = jest.fn();
  const service = new AuthService(
    { query } as unknown as DatabaseService,
    { grantOnce } as unknown as CreditsService,
    { accountProvisioned } as unknown as AnalyticsService,
  );
  const user = {
    id: 'user-a',
    cognito_user_id: 'cognito-a',
    email: 'person@example.com',
    stripe_customer_id: null,
    first_name: null,
    last_name: null,
    phone: null,
    birthday: null,
    country: 'CA',
    currency: 'CAD',
    language: 'English',
    marketing_opt_in: false,
    preferences: {},
    created_at: new Date('2026-07-22T12:00:00.000Z'),
    updated_at: new Date('2026-07-22T12:00:00.000Z'),
  };
  const claims: CognitoJwtClaims = {
    sub: 'cognito-a',
    email: 'person@example.com',
    iss: 'https://cognito-idp.example/pool',
    aud: 'client-a',
    token_use: 'id',
    exp: 1_900_000_000,
  };

  beforeEach(() => {
    query.mockReset();
    grantOnce.mockReset();
    accountProvisioned.mockReset().mockResolvedValue(undefined);
    query
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [] });
  });

  it('records account provisioning only when the starter grant is new', async () => {
    grantOnce.mockResolvedValue({
      granted: true,
      balance: { userId: 'user-a', balance: 2 },
    });

    await service.syncCognitoUser(claims);

    expect(accountProvisioned).toHaveBeenCalledWith('user-a');
  });

  it('does not duplicate provisioning analytics on a repeated auth sync', async () => {
    grantOnce.mockResolvedValue({
      granted: false,
      balance: { userId: 'user-a', balance: 2 },
    });

    await service.syncCognitoUser(claims);

    expect(accountProvisioned).not.toHaveBeenCalled();
  });
});
