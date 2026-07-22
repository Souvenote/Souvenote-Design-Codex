import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { CreateOrderInput } from './orders.service';

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number;
  tax_minor: number;
  total_minor: number;
  recipient_address: Record<string, unknown> | null;
  sender_address: Record<string, unknown> | null;
  request_sha256: string;
  placed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type OfferRow = {
  id: string;
  unit_amount_minor: number;
  minimum_quantity: number;
  maximum_quantity: number;
  currency: string;
};

const ORDER_COLUMNS = `
  id, order_number, status, currency, subtotal_minor, shipping_minor, tax_minor,
  total_minor, recipient_address, sender_address, request_sha256, placed_at, created_at, updated_at
`;

@Injectable()
export class OrdersRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    input: CreateOrderInput,
  ): Promise<OrderRow> {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
        `order:${userId}:${idempotencyKey}`,
      ]);
      const existing = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = $1 AND idempotency_key = $2;`,
        [userId, idempotencyKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_sha256 !== requestHash) {
          throw new ConflictException({
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'The Idempotency-Key was already used with a different order.',
          });
        }
        return existing.rows[0];
      }

      const offer = await client.query<OfferRow>(
        `SELECT offer.id, offer.unit_amount_minor, offer.minimum_quantity, offer.maximum_quantity, book.currency
         FROM price_offers offer JOIN price_books book ON book.id = offer.price_book_id
         WHERE offer.id = $1 AND offer.checkout_enabled = TRUE
           AND book.status = 'active' AND book.market_country = 'CA' AND book.currency = 'CAD'
           AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
           AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp());`,
        [input.offerId],
      );
      const selectedOffer = offer.rows[0];
      if (!selectedOffer) {
        throw new ConflictException({
          code: 'OFFER_NOT_AVAILABLE',
          message: 'The selected offer is not available for checkout.',
        });
      }
      if (input.quantity < selectedOffer.minimum_quantity || input.quantity > selectedOffer.maximum_quantity) {
        throw new ConflictException({
          code: 'OFFER_QUANTITY_INVALID',
          message: 'The quantity is outside the selected offer range.',
        });
      }

      const asset = await client.query<{ revision_id: string }>(
        `SELECT asset.revision_id
         FROM assets asset JOIN card_drafts draft ON draft.id = asset.card_draft_id AND draft.user_id = asset.user_id
         WHERE asset.id = $1 AND asset.user_id = $2 AND asset.card_draft_id = $3
           AND asset.generation_status = 'ready' AND asset.asset_type IN ('image', 'print')
           AND draft.status = 'approved';`,
        [input.selectedAssetId, userId, input.cardDraftId],
      );
      if (!asset.rows[0]) throw new NotFoundException('Approved card asset not found.');

      const subtotal = selectedOffer.unit_amount_minor * input.quantity;
      const orderNumber = `SOUV-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const inserted = await client.query<OrderRow>(
        `INSERT INTO orders
           (user_id, order_number, currency, subtotal_minor, shipping_minor, tax_minor, total_minor,
            recipient_address, sender_address, idempotency_key, request_sha256)
         VALUES ($1, $2, $3, $4, 0, 0, $4, $5::jsonb, $6::jsonb, $7, $8)
         RETURNING ${ORDER_COLUMNS};`,
        [
          userId,
          orderNumber,
          selectedOffer.currency,
          subtotal,
          JSON.stringify(input.recipientAddress),
          JSON.stringify(input.senderAddress),
          idempotencyKey,
          requestHash,
        ],
      );
      const order = this.requireRow(inserted.rows[0]);
      await client.query(
        `INSERT INTO order_items
           (user_id, order_id, card_draft_id, price_offer_id, print_asset_id,
            quantity, unit_amount_minor, total_amount_minor, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          userId,
          order.id,
          input.cardDraftId,
          selectedOffer.id,
          input.selectedAssetId,
          input.quantity,
          selectedOffer.unit_amount_minor,
          subtotal,
          selectedOffer.currency,
        ],
      );
      return order;
    });
  }

  async list(userId: string, limit: number, cursor?: string): Promise<OrderRow[]> {
    const result = await this.database.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR (created_at, id) < (
           SELECT created_at, id FROM orders WHERE id = $2 AND user_id = $1
         ))
       ORDER BY created_at DESC, id DESC LIMIT $3;`,
      [userId, cursor ?? null, limit],
    );
    return result.rows;
  }

  async get(userId: string, orderId: string): Promise<OrderRow> {
    const result = await this.database.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 AND user_id = $2;`,
      [orderId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  static toApi(row: OrderRow) {
    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      currency: row.currency,
      subtotalMinor: row.subtotal_minor,
      shippingMinor: row.shipping_minor,
      taxMinor: row.tax_minor,
      totalMinor: row.total_minor,
      recipientAddress: row.recipient_address,
      senderAddress: row.sender_address,
      placedAt: row.placed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private requireRow(row: OrderRow | undefined): OrderRow {
    if (!row) throw new NotFoundException('Order not found.');
    return row;
  }
}
