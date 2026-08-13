import type { PricingOffer } from '../lib/api';
import { deliveryOfferStatus, selectDeliveryOffer, toCanadianPostalAddress } from './deliveryCheckout';

const offers: PricingOffer[] = [
  {
    id: 'try_risk_free',
    offerId: 'try-risk-free',
    name: 'Try Risk-Free',
    type: 'try_risk_free',
    currency: 'CAD',
    priceCents: 999,
    cardCountMin: 1,
    cardCountMax: 1,
    creditsPerCard: 10,
    shippingIncluded: true,
    authorizationAmountCents: 999,
    noSendFeeCents: 200,
    authorizationDays: 5,
    checkoutEnabled: true,
    metadata: {},
  },
  {
    id: 'big_sender_2_10',
    offerId: 'big-sender',
    name: 'Big Sender',
    type: 'big_sender',
    currency: 'CAD',
    priceCents: 899,
    cardCountMin: 2,
    cardCountMax: 10,
    creditsPerCard: 10,
    shippingIncluded: true,
    authorizationAmountCents: null,
    noSendFeeCents: null,
    authorizationDays: null,
    checkoutEnabled: true,
    metadata: {},
  },
];

describe('delivery checkout helpers', () => {
  it('selects the server offer for the exact physical-card quantity', () => {
    expect(selectDeliveryOffer(offers, 1)?.offerId).toBe('try-risk-free');
    expect(selectDeliveryOffer(offers, 2)?.offerId).toBe('big-sender');
    expect(selectDeliveryOffer(offers, 11)).toBeUndefined();
  });

  it('normalizes Canadian postal input without changing authoritative totals', () => {
    expect(
      toCanadianPostalAddress({
        title: '',
        firstName: ' Ada ',
        lastName: 'Lovelace',
        company: '',
        address1: ' 123 Main St ',
        address2: 'Unit 4',
        address3: '',
        city: ' Vancouver ',
        state: 'bc',
        postalCode: 'v6b 1a1',
        country: 'CA',
      }),
    ).toEqual({
      name: 'Ada Lovelace',
      line1: '123 Main St',
      line2: 'Unit 4',
      city: 'Vancouver',
      region: 'BC',
      postalCode: 'V6B 1A1',
      country: 'CA',
    });
    expect(deliveryOfferStatus(offers[1], 2)).toBe('2 cards · CAD $17.98');
  });
});
