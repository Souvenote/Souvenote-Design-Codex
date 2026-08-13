import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export type CheckoutPurpose = 'physical_order' | 'credit_pack';
export type CheckoutCollectionMode = 'automatic' | 'manual';

export type CheckoutSessionRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  credit_pack_purchase_id: string | null;
  payment_id: string | null;
  provider: 'mock' | 'stripe';
  provider_session_id: string | null;
  purpose: CheckoutPurpose;
  status: 'creating' | 'open' | 'completed' | 'expired' | 'canceled' | 'failed';
  collection_mode: CheckoutCollectionMode;
  currency: 'CAD';
  amount_minor: number;
  request_sha256: string;
  expires_at: Date | string;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type PhysicalCheckoutRow = {
  order_id: string;
  currency: 'CAD';
  total_minor: number;
  offer_type: 'try_risk_free' | 'big_sender';
  authorization_amount_minor: number | null;
};

const SESSION_COLUMNS = `
  id, user_id, order_id, credit_pack_purchase_id, payment_id, provider,
  provider_session_id, purpose, status, collection_mode, currency, amount_minor,
  request_sha256, expires_at, completed_at, created_at, updated_at
`;

@Injectable()
export class CheckoutRepository {
  constructor(private readonly database: DatabaseService) {}

  async createPhysical(userId: string, orderId: string, idempotencyKey: string, requestHash: string) {
    return this.database.transaction(async (client) => {
      await this.lock(client, userId, idempotencyKey);
      const existing = await this.findByIdempotency(client, userId, idempotencyKey);
      if (existing) return this.requireSameRequest(existing, requestHash);

      const orderResult = await client.query<PhysicalCheckoutRow>(
        `SELECT order_record.id AS order_id, order_record.currency, order_record.total_minor,
                offer.offer_type, offer.authorization_amount_minor
         FROM orders order_record
         JOIN order_items item ON item.order_id = order_record.id AND item.user_id = order_record.user_id
         JOIN price_offers offer ON offer.id = item.price_offer_id
         WHERE order_record.id = $1 AND order_record.user_id = $2
           AND order_record.status = 'pending_payment'
           AND offer.checkout_enabled = TRUE
         ORDER BY item.created_at, item.id
         LIMIT 1
         FOR UPDATE OF order_record;`,
        [orderId, userId],
      );
      const order = orderResult.rows[0];
      if (!order) throw new NotFoundException('Order not found.');
      const collectionMode: CheckoutCollectionMode = order.offer_type === 'try_risk_free' ? 'manual' : 'automatic';
      const amountMinor =
        order.offer_type === 'try_risk_free' ? (order.authorization_amount_minor ?? 0) : order.total_minor;
      if (amountMinor <= 0 || order.currency !== 'CAD') {
        throw new ConflictException({ code: 'ORDER_TOTAL_INVALID', message: 'The server-owned CAD total is invalid.' });
      }

      const payment = await client.query<{ id: string }>(
        `INSERT INTO payments
           (user_id, order_id, provider, currency, idempotency_key)
         VALUES ($1, $2, 'mock', $3, $4)
         RETURNING id;`,
        [userId, order.order_id, order.currency, `checkout-payment:${idempotencyKey}`],
      );
      const paymentId = payment.rows[0]?.id;
      if (!paymentId) throw new Error('Payment creation returned no row.');

      const inserted = await client.query<CheckoutSessionRow>(
        `INSERT INTO checkout_sessions
           (user_id, order_id, payment_id, provider, purpose, collection_mode,
            currency, amount_minor, request_sha256, idempotency_key, expires_at)
         VALUES ($1, $2, $3, 'mock', 'physical_order', $4, $5, $6, $7, $8,
                 clock_timestamp() + INTERVAL '30 minutes')
         RETURNING ${SESSION_COLUMNS};`,
        [userId, order.order_id, paymentId, collectionMode, order.currency, amountMinor, requestHash, idempotencyKey],
      );
      return this.requireRow(inserted.rows[0]);
    });
  }

  async createCreditPack(userId: string, offerCode: string, idempotencyKey: string, requestHash: string) {
    return this.database.transaction(async (client) => {
      await this.lock(client, userId, idempotencyKey);
      const existing = await this.findByIdempotency(client, userId, idempotencyKey);
      if (existing) return this.requireSameRequest(existing, requestHash);

      const offerResult = await client.query<{
        id: string;
        currency: 'CAD';
        unit_amount_minor: number;
        credit_quantity: number;
      }>(
        `SELECT offer.id, book.currency, offer.unit_amount_minor, offer.credit_quantity
         FROM credit_pack_offers offer
         JOIN price_books book ON book.id = offer.price_book_id
         WHERE offer.offer_code = $1 AND offer.catalog_visible = TRUE AND offer.checkout_enabled = TRUE
           AND book.status = 'active' AND book.market_country = 'CA' AND book.currency = 'CAD'
           AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
           AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp())
         ORDER BY offer.version DESC LIMIT 1;`,
        [offerCode],
      );
      const offer = offerResult.rows[0];
      if (!offer) {
        throw new ConflictException({ code: 'PRICE_NOT_AVAILABLE', message: 'The CAD credit pack is unavailable.' });
      }

      const purchase = await client.query<{ id: string }>(
        `INSERT INTO credit_pack_purchases
           (user_id, credit_pack_offer_id, provider, currency, amount_minor,
            credit_quantity, request_hash, idempotency_key)
         VALUES ($1, $2, 'mock', $3, $4, $5, $6, $7)
         RETURNING id;`,
        [
          userId,
          offer.id,
          offer.currency,
          offer.unit_amount_minor,
          offer.credit_quantity,
          requestHash,
          `checkout-purchase:${idempotencyKey}`,
        ],
      );
      const purchaseId = purchase.rows[0]?.id;
      if (!purchaseId) throw new Error('Credit-pack purchase creation returned no row.');

      const inserted = await client.query<CheckoutSessionRow>(
        `INSERT INTO checkout_sessions
           (user_id, credit_pack_purchase_id, provider, purpose, collection_mode,
            currency, amount_minor, request_sha256, idempotency_key, expires_at)
         VALUES ($1, $2, 'mock', 'credit_pack', 'automatic', $3, $4, $5, $6,
                 clock_timestamp() + INTERVAL '30 minutes')
         RETURNING ${SESSION_COLUMNS};`,
        [userId, purchaseId, offer.currency, offer.unit_amount_minor, requestHash, idempotencyKey],
      );
      return this.requireRow(inserted.rows[0]);
    });
  }

  async open(userId: string, sessionId: string, providerSessionId: string): Promise<CheckoutSessionRow> {
    return this.database.transaction(async (client) => {
      const current = await client.query<CheckoutSessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM checkout_sessions
         WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
        [sessionId, userId],
      );
      const session = this.requireRow(current.rows[0]);
      if (session.status === 'open' && session.provider_session_id === providerSessionId) return session;
      if (session.status !== 'creating') {
        throw new ConflictException({ code: 'CHECKOUT_SESSION_NOT_CREATING', message: 'Checkout cannot be opened.' });
      }
      const updated = await client.query<CheckoutSessionRow>(
        `UPDATE checkout_sessions
         SET status = 'open', provider_session_id = $3
         WHERE id = $1 AND user_id = $2
         RETURNING ${SESSION_COLUMNS};`,
        [sessionId, userId, providerSessionId],
      );
      return this.requireRow(updated.rows[0]);
    });
  }

  async failCreation(userId: string, sessionId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      const current = await client.query<CheckoutSessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM checkout_sessions
         WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
        [sessionId, userId],
      );
      const session = this.requireRow(current.rows[0]);
      if (session.status !== 'creating') return;
      await client.query(`UPDATE checkout_sessions SET status = 'failed' WHERE id = $1;`, [session.id]);
      if (session.purpose === 'credit_pack') {
        await client.query(`UPDATE credit_pack_purchases SET status = 'failed' WHERE id = $1 AND status = 'pending';`, [
          session.credit_pack_purchase_id,
        ]);
      } else {
        await client.query(`UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending';`, [
          session.payment_id,
        ]);
        await client.query(
          `UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND user_id = $2 AND status = 'pending_payment';`,
          [session.order_id, userId],
        );
      }
    });
  }

  async get(userId: string, sessionId: string): Promise<CheckoutSessionRow> {
    const result = await this.database.query<CheckoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM checkout_sessions WHERE id = $1 AND user_id = $2;`,
      [sessionId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  async findByProviderSession(provider: 'stripe', providerSessionId: string): Promise<CheckoutSessionRow | undefined> {
    const result = await this.database.query<CheckoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM checkout_sessions WHERE provider = $1 AND provider_session_id = $2;`,
      [provider, providerSessionId],
    );
    return result.rows[0];
  }

  async complete(sessionId: string, providerPaymentId: string): Promise<boolean> {
    const result = await this.database.query<{ checkout_session_id: string }>(
      `SELECT checkout_session_id FROM complete_checkout_session($1, $2, clock_timestamp());`,
      [sessionId, providerPaymentId],
    );
    return Boolean(result.rows[0]);
  }

  async fail(sessionId: string, errorCategory: string): Promise<boolean> {
    const result = await this.database.query<{ checkout_session_id: string }>(
      `SELECT checkout_session_id FROM fail_checkout_session($1, $2);`,
      [sessionId, errorCategory],
    );
    return Boolean(result.rows[0]);
  }

  static toApi(row: CheckoutSessionRow) {
    return {
      id: row.id,
      purpose: row.purpose,
      orderId: row.order_id,
      creditPackPurchaseId: row.credit_pack_purchase_id,
      paymentId: row.payment_id,
      provider: row.provider,
      status: row.status,
      collectionMode: row.collection_mode,
      currency: row.currency,
      amountMinor: row.amount_minor,
      checkoutUrl: row.status === 'open' && row.provider === 'mock' ? `/checkout/test/${row.id}` : null,
      expiresAt: row.expires_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async lock(client: PoolClient, userId: string, idempotencyKey: string): Promise<void> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
      `checkout:${userId}:${idempotencyKey}`,
    ]);
  }

  private async findByIdempotency(client: PoolClient, userId: string, idempotencyKey: string) {
    const result = await client.query<CheckoutSessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM checkout_sessions WHERE user_id = $1 AND idempotency_key = $2;`,
      [userId, idempotencyKey],
    );
    return result.rows[0];
  }

  private requireSameRequest(session: CheckoutSessionRow, requestHash: string): CheckoutSessionRow {
    if (session.request_sha256 !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The Idempotency-Key was already used with different checkout input.',
      });
    }
    return session;
  }

  private requireRow(row: CheckoutSessionRow | undefined): CheckoutSessionRow {
    if (!row) throw new NotFoundException('Checkout session not found.');
    return row;
  }
}
