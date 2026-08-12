import type { PricingOffer } from '../lib/api';
import type { DeliveryRecipient } from './DeliveryForm';

export type FulfillmentVariant = 'personalized' | 'blank_handoff';

export function selectDeliveryOffer(offers: PricingOffer[], cardsNeeded: number): PricingOffer | undefined {
  return offers.find(
    (offer) =>
      cardsNeeded >= offer.cardCountMin &&
      cardsNeeded <= offer.cardCountMax &&
      (cardsNeeded === 1 ? offer.type === 'try_risk_free' : offer.type === 'big_sender'),
  );
}

export function toCanadianPostalAddress(value: DeliveryRecipient) {
  return {
    name: [value.firstName, value.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' '),
    line1: value.address1.trim(),
    ...([value.company, value.address2, value.address3].some((part) => part.trim())
      ? { line2: [value.company, value.address2, value.address3].filter((part) => part.trim()).join(', ') }
      : {}),
    city: value.city.trim(),
    region: value.state.trim().toUpperCase(),
    postalCode: value.postalCode.trim().toUpperCase(),
    country: 'CA' as const,
  };
}

export function deliveryOfferStatus(offer: PricingOffer | undefined, cardsNeeded: number): string {
  if (!offer) return 'Loading server-owned CAD price';
  if (cardsNeeded === 1) return 'Try Risk-Free · CAD $9.99 authorization';
  return `${cardsNeeded} cards · CAD $${((offer.priceCents * cardsNeeded) / 100).toFixed(2)}`;
}
