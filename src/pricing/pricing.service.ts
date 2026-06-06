import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type PricingOfferRow = {
  id: string;
  offer_code: string;
  name: string;
  offer_type: string;
  price_cents: number;
  currency: string;
  card_count_min: number;
  card_count_max: number;
  credits_per_card: number;
  shipping_included: boolean;
  metadata: Record<string, unknown> | null;
};

@Injectable()
export class PricingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const result = await this.databaseService.query<PricingOfferRow>(
      `
        SELECT
          id,
          offer_code,
          name,
          offer_type,
          price_cents,
          currency,
          card_count_min,
          card_count_max,
          credits_per_card,
          shipping_included,
          metadata
        FROM pricing_catalog
        WHERE is_active = TRUE
        ORDER BY card_count_min ASC;
      `,
    );

    return {
      data: result.rows.map((offer) => ({
        id: offer.offer_code,
        databaseId: offer.id,
        name: offer.name,
        type: offer.offer_type,
        priceCents: offer.price_cents,
        currency: offer.currency,
        cardCountMin: offer.card_count_min,
        cardCountMax: offer.card_count_max,
        creditsPerCard: offer.credits_per_card,
        shippingIncluded: offer.shipping_included,
        metadata: offer.metadata ?? {},
      })),
    };
  }
}