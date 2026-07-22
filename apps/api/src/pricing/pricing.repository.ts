import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type OfferRow = {
  id: string;
  offer_code: string;
  offer_type: string;
  unit_amount_minor: number;
  authorization_amount_minor: number | null;
  no_send_fee_minor: number | null;
  authorization_days: number | null;
  minimum_quantity: number;
  maximum_quantity: number;
  credits_per_card: number;
  shipping_included: boolean;
  checkout_enabled: boolean;
  currency: string;
  market_country: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class PricingRepository {
  constructor(private readonly database: DatabaseService) {}

  async findActiveCanadaOffers(): Promise<OfferRow[]> {
    const result = await this.database.query<OfferRow>(
      `SELECT offer.id, offer.offer_code, offer.offer_type, offer.unit_amount_minor,
              offer.authorization_amount_minor, offer.no_send_fee_minor, offer.authorization_days,
              offer.minimum_quantity, offer.maximum_quantity, offer.credits_per_card,
              offer.shipping_included, offer.checkout_enabled, book.currency,
              book.market_country, offer.metadata
       FROM price_offers offer
       JOIN price_books book ON book.id = offer.price_book_id
       WHERE book.market_country = 'CA' AND book.currency = 'CAD'
         AND book.status = 'active' AND offer.catalog_visible = TRUE
         AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
         AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp())
       ORDER BY offer.minimum_quantity, offer.unit_amount_minor;`,
    );
    return result.rows;
  }

  static toApi(row: OfferRow) {
    return {
      id: row.offer_code,
      offerId: row.id,
      type: row.offer_type,
      unitAmountMinor: row.unit_amount_minor,
      authorizationAmountMinor: row.authorization_amount_minor,
      noSendFeeMinor: row.no_send_fee_minor,
      authorizationDays: row.authorization_days,
      currency: row.currency,
      marketCountry: row.market_country,
      minimumQuantity: row.minimum_quantity,
      maximumQuantity: row.maximum_quantity,
      creditsPerCard: row.credits_per_card,
      shippingIncluded: row.shipping_included,
      checkoutEnabled: row.checkout_enabled,
      metadata: row.metadata,
    };
  }
}
