import type { CreditPackCode, CreditPackOffer } from '../lib/api';

export type CreditPackCard = {
  id: CreditPackCode;
  name: string;
  price: string;
  tokens: string;
  blurb: string;
  accent: string;
  featured?: boolean;
  badge?: string;
  checkoutEnabled: boolean;
};

const PRESENTATION: Record<CreditPackCode, Pick<CreditPackCard, 'accent' | 'blurb' | 'featured' | 'badge'>> = {
  credit_pack_10: {
    blurb: 'A quick top-up for one more card.',
    accent: 'platinum',
  },
  credit_pack_80: {
    blurb: 'Our most popular: a season of cards and songs.',
    accent: 'gold',
    featured: true,
    badge: 'Most popular',
  },
  credit_pack_250: {
    blurb: 'Best value for repeat senders and makers.',
    accent: 'rose',
  },
};

export function creditPackFromOffer(offer: CreditPackOffer): CreditPackCard {
  return {
    id: offer.id,
    name: offer.name,
    price: `$${(offer.priceCents / 100).toFixed(2)} CAD`,
    tokens: String(offer.creditQuantity),
    checkoutEnabled: offer.checkoutEnabled,
    ...PRESENTATION[offer.id],
  };
}

export function creditPackPurchaseLabel(pack: CreditPackCard, purchasing: boolean): string {
  return purchasing ? 'Adding credits...' : `Add ${pack.tokens} credits`;
}
