import { BadRequestException, Injectable } from '@nestjs/common';
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
        creditAmount: this.creditAmount(offer),
        shippingIncluded: offer.shipping_included,
        metadata: offer.metadata ?? {},
      })),
    };
  }

  async resolveOrderOffer(offerCode: string | undefined, quantity: number) {
    const normalizedOfferCode = offerCode?.trim() || null;
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
          AND offer_type IN ('try_risk_free', 'big_sender')
          AND ($1::VARCHAR IS NULL OR offer_code = $1)
          AND $2 BETWEEN card_count_min AND card_count_max
        ORDER BY card_count_min DESC, offer_code ASC
        LIMIT 1;
      `,
      [normalizedOfferCode, quantity],
    );

    const offer = result.rows[0];
    if (!offer) {
      throw new BadRequestException(
        normalizedOfferCode
          ? 'The selected pricing offer is unavailable for this quantity.'
          : 'No active pricing offer is available for this quantity.',
      );
    }

    if (
      !Number.isInteger(offer.price_cents) ||
      offer.price_cents <= 0 ||
      offer.currency.trim().toLowerCase() !== 'cad'
    ) {
      throw new BadRequestException(
        'The selected pricing offer is not configured correctly.',
      );
    }

    return offer;
  }

  async resolveCreditPackOffer(offerCode: string) {
    const normalizedOfferCode = offerCode.trim();
    if (!normalizedOfferCode) {
      throw new BadRequestException('A credit-pack offer code is required.');
    }

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
          AND offer_type = 'credit_pack'
          AND offer_code = $1
        LIMIT 1;
      `,
      [normalizedOfferCode],
    );

    const offer = result.rows[0];
    const creditAmount = offer ? this.creditAmount(offer) : null;
    if (
      !offer ||
      !Number.isInteger(offer.price_cents) ||
      offer.price_cents <= 0 ||
      offer.currency.trim().toLowerCase() !== 'cad' ||
      !creditAmount
    ) {
      throw new BadRequestException(
        'The selected credit pack is unavailable or is not configured correctly.',
      );
    }

    return { ...offer, creditAmount };
  }

  private creditAmount(offer: PricingOfferRow) {
    if (offer.offer_type !== 'credit_pack') return null;
    const configured = Number(
      offer.metadata?.credit_amount ?? offer.credits_per_card,
    );
    return Number.isInteger(configured) && configured > 0 ? configured : null;
  }
}
