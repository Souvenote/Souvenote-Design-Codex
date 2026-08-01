import { creditPackFromOffer, creditPackPurchaseLabel } from './creditPackCatalog';
import type { CreditPackOffer } from '../lib/api';

const offers: CreditPackOffer[] = [
  {
    id: 'credit_pack_10',
    offerId: '33000000-0000-4000-8000-000000000001',
    name: 'Starter',
    creditQuantity: 10,
    priceCents: 200,
    currency: 'CAD',
    checkoutEnabled: false,
    metadata: {},
  },
  {
    id: 'credit_pack_80',
    offerId: '33000000-0000-4000-8000-000000000002',
    name: 'Studio',
    creditQuantity: 80,
    priceCents: 1000,
    currency: 'CAD',
    checkoutEnabled: false,
    metadata: {},
  },
  {
    id: 'credit_pack_250',
    offerId: '33000000-0000-4000-8000-000000000003',
    name: 'Atelier',
    creditQuantity: 250,
    priceCents: 2500,
    currency: 'CAD',
    checkoutEnabled: false,
    metadata: {},
  },
];

describe('standalone credit-pack presentation', () => {
  it('renders the exact server-owned CAD packs as purchasable products', () => {
    const packs = offers.map(creditPackFromOffer);
    expect(
      packs.map((pack) => ({
        id: pack.id,
        price: pack.price,
        tokens: pack.tokens,
        label: creditPackPurchaseLabel(pack, false),
      })),
    ).toEqual([
      { id: 'credit_pack_10', price: '$2.00 CAD', tokens: '10', label: 'Add 10 credits' },
      { id: 'credit_pack_80', price: '$10.00 CAD', tokens: '80', label: 'Add 80 credits' },
      { id: 'credit_pack_250', price: '$25.00 CAD', tokens: '250', label: 'Add 250 credits' },
    ]);
    expect(packs.map((pack) => pack.price).join(' ')).not.toMatch(/coming soon/i);
  });

  it('uses an explicit in-progress label without changing the selected pack', () => {
    expect(creditPackPurchaseLabel(creditPackFromOffer(offers[0]!), true)).toBe('Adding credits...');
  });
});
