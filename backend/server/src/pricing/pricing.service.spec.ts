import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const query = jest.fn();
  const service = new PricingService({
    query,
  } as unknown as DatabaseService);

  beforeEach(() => {
    query.mockReset();
  });

  it('resolves an active tier only when the quantity is inside its bounds', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'tier-id',
          offer_code: 'big_sender_2_10',
          name: 'Big Sender 2-10 Cards',
          offer_type: 'big_sender',
          price_cents: 899,
          currency: 'cad',
          card_count_min: 2,
          card_count_max: 10,
          credits_per_card: 10,
          shipping_included: true,
          metadata: {},
        },
      ],
    });

    await expect(
      service.resolveOrderOffer('big_sender_2_10', 5),
    ).resolves.toMatchObject({ offer_code: 'big_sender_2_10' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('$2 BETWEEN card_count_min AND card_count_max'),
      ['big_sender_2_10', 5],
    );
  });

  it('rejects an inactive, unknown, or out-of-range explicit offer', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.resolveOrderOffer('big_sender_2_10', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a malformed catalog price instead of creating an order total', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          offer_code: 'broken',
          price_cents: 0,
          currency: 'usd',
        },
      ],
    });

    await expect(service.resolveOrderOffer('broken', 1)).rejects.toThrow(
      'not configured correctly',
    );
  });

  it('rejects a non-CAD card offer for the Canada launch', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          offer_code: 'wrong_currency',
          offer_type: 'try_risk_free',
          price_cents: 999,
          currency: 'usd',
        },
      ],
    });

    await expect(
      service.resolveOrderOffer('wrong_currency', 1),
    ).rejects.toThrow('not configured correctly');
  });

  it('resolves only a configured CAD standalone credit pack', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'credit-pack-id',
          offer_code: 'credit_pack_creator_80',
          name: 'Creator Credits',
          offer_type: 'credit_pack',
          price_cents: 1000,
          currency: 'cad',
          card_count_min: 0,
          card_count_max: 0,
          credits_per_card: 80,
          shipping_included: false,
          metadata: { credit_amount: 80 },
        },
      ],
    });

    await expect(
      service.resolveCreditPackOffer('credit_pack_creator_80'),
    ).resolves.toMatchObject({
      offer_code: 'credit_pack_creator_80',
      price_cents: 1000,
      currency: 'cad',
      creditAmount: 80,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("offer_type = 'credit_pack'"),
      ['credit_pack_creator_80'],
    );
  });

  it('does not resolve a non-CAD or malformed credit pack', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          offer_code: 'credit_pack_broken',
          offer_type: 'credit_pack',
          price_cents: 200,
          currency: 'usd',
          credits_per_card: 10,
          metadata: { credit_amount: 10 },
        },
      ],
    });

    await expect(
      service.resolveCreditPackOffer('credit_pack_broken'),
    ).rejects.toThrow('unavailable or is not configured correctly');
  });
});
