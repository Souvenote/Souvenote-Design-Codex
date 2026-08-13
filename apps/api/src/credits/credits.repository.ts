import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

type CreditPackPurchaseRow = {
  id: string;
  offer_code: string;
  provider: string;
  status: string;
  currency: string;
  amount_minor: number;
  credit_quantity: number;
  request_hash: string;
  captured_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const PURCHASE_COLUMNS = `
  purchase.id, offer.offer_code, purchase.provider, purchase.status,
  purchase.currency, purchase.amount_minor, purchase.credit_quantity,
  purchase.request_hash, purchase.captured_at, purchase.created_at,
  purchase.updated_at
`;

@Injectable()
export class CreditsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findBalance(userId: string): Promise<number> {
    const result = await this.database.query<{ balance: number | string }>(
      `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
      [userId],
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  async purchaseMock(userId: string, offerCode: string, idempotencyKey: string, requestHash: string) {
    try {
      return await this.database.transaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
          `credit-pack:${userId}:${idempotencyKey}`,
        ]);
        const existing = await this.findPurchaseByIdempotency(client, userId, idempotencyKey);
        if (existing) {
          if (existing.request_hash !== requestHash) this.throwIdempotencyConflict();
          return { purchase: existing, balance: await this.balance(client, userId) };
        }

        const offerResult = await client.query<{
          id: string;
          offer_code: string;
          credit_quantity: number;
          unit_amount_minor: number;
          currency: string;
        }>(
          `SELECT offer.id, offer.offer_code, offer.credit_quantity,
                  offer.unit_amount_minor, book.currency
           FROM credit_pack_offers offer
           JOIN price_books book ON book.id = offer.price_book_id
           WHERE offer.offer_code = $1
             AND offer.catalog_visible = TRUE
             AND offer.checkout_enabled = FALSE
             AND book.status = 'active'
             AND book.market_country = 'CA'
             AND book.currency = 'CAD'
             AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
             AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp())
           ORDER BY offer.version DESC
           LIMIT 1;`,
          [offerCode],
        );
        const offer = offerResult.rows[0];
        if (!offer) {
          throw new ConflictException({
            code: 'PRICE_NOT_AVAILABLE',
            message: 'The selected standalone CAD credit pack is not available.',
          });
        }

        const inserted = await client.query<Omit<CreditPackPurchaseRow, 'offer_code'>>(
          `INSERT INTO credit_pack_purchases (
             user_id, credit_pack_offer_id, provider, status, currency,
             amount_minor, credit_quantity, request_hash, idempotency_key
           )
           VALUES ($1, $2, 'mock', 'pending', $3, $4, $5, $6, $7)
           RETURNING id, provider, status, currency, amount_minor, credit_quantity,
                     request_hash, captured_at, created_at, updated_at;`,
          [
            userId,
            offer.id,
            offer.currency,
            offer.unit_amount_minor,
            offer.credit_quantity,
            requestHash,
            idempotencyKey,
          ],
        );
        const pending = inserted.rows[0];
        if (!pending) throw new Error('Credit-pack purchase creation returned no row.');

        const capturedResult = await client.query<Omit<CreditPackPurchaseRow, 'offer_code'>>(
          `UPDATE credit_pack_purchases
           SET status = 'captured', captured_at = clock_timestamp()
           WHERE id = $1 AND user_id = $2 AND status = 'pending'
           RETURNING id, provider, status, currency, amount_minor, credit_quantity,
                     request_hash, captured_at, created_at, updated_at;`,
          [pending.id, userId],
        );
        const captured = capturedResult.rows[0];
        if (!captured) throw new Error('Credit-pack mock capture returned no row.');

        await client.query(
          `SELECT * FROM apply_credit_ledger_entry(
             $1, 'purchase_grant', $2, 'credit_pack_purchase', $3, $4,
             jsonb_build_object(
               'offer_code', $5::text,
               'amount_minor', $6::integer,
               'currency', $7::text,
               'provider', 'mock'
             )
           );`,
          [
            userId,
            offer.credit_quantity,
            captured.id,
            `credit-pack-credits:${captured.id}`,
            offer.offer_code,
            offer.unit_amount_minor,
            offer.currency,
          ],
        );

        await client.query(
          `INSERT INTO audit_events (
             actor_user_id, subject_user_id, action, entity_type, entity_id,
             idempotency_key, outcome, metadata
           )
           VALUES (
             $1, $1, 'credit_pack_purchase.mock_captured',
             'credit_pack_purchase', $2, $3, 'succeeded',
             jsonb_build_object(
               'offer_code', $4::text,
               'amount_minor', $5::integer,
               'credit_quantity', $6::integer,
               'currency', $7::text,
               'provider', 'mock'
             )
           );`,
          [
            userId,
            captured.id,
            idempotencyKey,
            offer.offer_code,
            offer.unit_amount_minor,
            offer.credit_quantity,
            offer.currency,
          ],
        );

        return {
          purchase: { ...captured, offer_code: offer.offer_code },
          balance: await this.balance(client, userId),
        };
      });
    } catch (error: unknown) {
      if (this.postgresCode(error) === '23505') this.throwIdempotencyConflict();
      throw error;
    }
  }

  async findPurchase(userId: string, purchaseId: string): Promise<CreditPackPurchaseRow> {
    const result = await this.database.query<CreditPackPurchaseRow>(
      `SELECT ${PURCHASE_COLUMNS}
       FROM credit_pack_purchases purchase
       JOIN credit_pack_offers offer ON offer.id = purchase.credit_pack_offer_id
       WHERE purchase.id = $1 AND purchase.user_id = $2;`,
      [purchaseId, userId],
    );
    return this.requirePurchase(result.rows[0]);
  }

  static purchaseToApi(row: CreditPackPurchaseRow) {
    return {
      id: row.id,
      offerCode: row.offer_code,
      status: row.status,
      provider: row.provider,
      currency: row.currency,
      amountMinor: row.amount_minor,
      creditQuantity: row.credit_quantity,
      creditsGranted: row.status === 'captured' ? row.credit_quantity : 0,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mockMode: row.provider === 'mock',
      productionEnabled: false,
    };
  }

  private async findPurchaseByIdempotency(client: PoolClient, userId: string, idempotencyKey: string) {
    const result = await client.query<CreditPackPurchaseRow>(
      `SELECT ${PURCHASE_COLUMNS}
       FROM credit_pack_purchases purchase
       JOIN credit_pack_offers offer ON offer.id = purchase.credit_pack_offer_id
       WHERE purchase.user_id = $1 AND purchase.idempotency_key = $2;`,
      [userId, idempotencyKey],
    );
    return result.rows[0];
  }

  private async balance(client: Pick<PoolClient, 'query'>, userId: string): Promise<number> {
    const result = await client.query<{ balance: number | string }>(
      `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
      [userId],
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  private requirePurchase(row: CreditPackPurchaseRow | undefined): CreditPackPurchaseRow {
    if (!row) throw new NotFoundException('Credit-pack purchase not found.');
    return row;
  }

  private throwIdempotencyConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The Idempotency-Key was already used with different input.',
    });
  }

  private postgresCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
