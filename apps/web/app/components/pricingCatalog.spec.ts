import {
  BIG_SENDER_TIERS,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
  getBigSenderPricing,
  makeTryRiskFreeCartItem,
} from './pricingCatalog';

describe('Canada MVP pricing presentation', () => {
  it('starts Big Sender at two cards and locks all approved CAD tiers', () => {
    expect({ min: MIN_BIG_SENDER_CARDS, max: MAX_BIG_SENDER_CARDS, tiers: BIG_SENDER_TIERS }).toEqual({
      min: 2,
      max: 30,
      tiers: [
        { min: 2, max: 10, pricePerCard: 8.99, label: '2-10 cards' },
        { min: 11, max: 20, pricePerCard: 7.99, label: '11-20 cards' },
        { min: 21, max: 30, pricePerCard: 6.99, label: '21-30 cards' },
      ],
    });
    expect(getBigSenderPricing(1)).toMatchObject({ qty: 2, total: 17.98 });
    expect(getBigSenderPricing(11)).toMatchObject({ qty: 11, total: 87.89 });
    expect(getBigSenderPricing(30)).toMatchObject({ qty: 30, total: 209.7 });
  });

  it('states the five-day fixed-fee Try Risk-Free behavior', () => {
    const item = makeTryRiskFreeCartItem();
    expect(item.price).toBe(9.99);
    expect(item.creditsPerCard).toBe(10);
    expect(item.sub).toContain('5-day authorization');
    expect(item.sub).toContain('fixed $2.00');
    expect(item.sub).not.toMatch(/per credit|seven|7-day/i);
  });
});
