import { ConfigService } from '@nestjs/config';
import { CreditsService } from '../credits/credits.service';
import { DatabaseService } from '../database/database.service';
import { ReferralsService } from './referrals.service';

describe('ReferralsService', () => {
  const query = jest.fn();
  const service = new ReferralsService(
    { query } as unknown as DatabaseService,
    {
      get: jest.fn((key: string) =>
        key === 'GIFT_REFERRAL_HMAC_SECRET'
          ? 'test-referral-secret-with-at-least-32-bytes'
          : undefined,
      ),
    } as unknown as ConfigService,
    {} as CreditsService,
  );

  beforeEach(() => query.mockReset());

  it('returns a signed personal link and the authoritative give-10/get-10 rules', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const dashboard = await service.dashboard(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(dashboard.referral.token).toMatch(/^u\./);
    expect(dashboard.referral.path).toContain(
      encodeURIComponent(dashboard.referral.token),
    );
    expect(dashboard.program).toEqual({
      inviteeStarterCreditsTotal: 10,
      inviteeReferralBonusCredits: 8,
      referrerRewardCredits: 10,
      referrerQualification: 'first_physical_send',
    });
    expect(dashboard.earnedCredits).toBe(0);
  });

  it('does not grant a reward when the sender has no claimed referral', async () => {
    const transaction = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(
      service.rewardReferrerForFirstSend(
        transaction,
        'referred-user',
        'order-a',
      ),
    ).resolves.toBeNull();
  });
});
