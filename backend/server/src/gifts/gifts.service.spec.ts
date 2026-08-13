import { ConfigService } from '@nestjs/config';
import { CardEntitlementsService } from '../card-entitlements/card-entitlements.service';
import { CreditsService } from '../credits/credits.service';
import { DatabaseService } from '../database/database.service';
import { GiftsService } from './gifts.service';

describe('GiftsService', () => {
  const query = jest.fn();
  const database = { query } as unknown as DatabaseService;
  const config = {
    get: jest.fn((key: string) =>
      key === 'GIFT_REFERRAL_HMAC_SECRET'
        ? 'test-gift-secret-with-at-least-32-bytes'
        : undefined,
    ),
  } as unknown as ConfigService;
  const service = new GiftsService(
    database,
    config,
    {} as CardEntitlementsService,
    {} as CreditsService,
  );

  beforeEach(() => query.mockReset());

  it('creates a signed, stable redemption token without exposing contact data', () => {
    const token = service.claimToken('11111111-1111-4111-8111-111111111111');
    expect(token).toMatch(
      /^g\.11111111-1111-4111-8111-111111111111\.[0-9a-f]{64}$/,
    );
    expect(service.claimToken('11111111-1111-4111-8111-111111111111')).toBe(
      token,
    );
    expect(token).not.toContain('@');
  });

  it('rejects incomplete recipient details before writing a gift', async () => {
    await expect(
      service.ensureGiftForCardPack(
        { query: jest.fn() },
        'buyer-a',
        'purchase-a',
        'gift',
        { recipientName: 'Jordan', deliveryMethod: 'email' },
      ),
    ).rejects.toThrow(
      'Recipient name, delivery method, and contact are required',
    );
  });

  it('does not allow gift fields on a normal Big Sender purchase', async () => {
    await expect(
      service.ensureGiftForCardPack(
        { query: jest.fn() },
        'buyer-a',
        'purchase-a',
        'big_sender',
        { recipientName: 'Jordan' },
      ),
    ).rejects.toThrow('only be used with a gift offer');
  });
});
