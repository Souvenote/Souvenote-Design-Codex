import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

type EntitlementRow = {
  id: string;
  source_type: string;
  status: string;
  quantity_total: number;
  quantity_reserved: number;
  quantity_consumed: number;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReservationRow = {
  id: string;
  price_offer_id: string;
  offer_code: string;
  status: string;
  quantity: number;
  unit_amount_minor: number;
  total_amount_minor: number;
  currency: string;
  request_hash: string;
  release_idempotency_key: string | null;
  expires_at: Date | string;
  released_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type TryRiskFreeRow = {
  id: string;
  entitlement_id: string | null;
  status: string;
  currency: string;
  authorized_amount_minor: number;
  captured_amount_minor: number;
  released_amount_minor: number;
  credits_granted: number;
  request_hash: string;
  authorized_at: Date | string;
  authorization_expires_at: Date | string;
  fulfillment_started_at: Date | string | null;
  resolved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const RESERVATION_COLUMNS = `
  reservation.id, reservation.price_offer_id, offer.offer_code, reservation.status,
  reservation.quantity, reservation.unit_amount_minor, reservation.total_amount_minor,
  reservation.currency, reservation.request_hash, reservation.expires_at,
  reservation.release_idempotency_key, reservation.released_at,
  reservation.created_at, reservation.updated_at
`;

const TRY_RISK_FREE_COLUMNS = `
  auth_record.id, auth_record.entitlement_id, auth_record.status,
  auth_record.currency, auth_record.authorized_amount_minor,
  auth_record.captured_amount_minor, auth_record.released_amount_minor,
  auth_record.credits_granted, auth_record.request_hash, auth_record.authorized_at,
  auth_record.authorization_expires_at, auth_record.fulfillment_started_at,
  auth_record.resolved_at, auth_record.created_at, auth_record.updated_at
`;

@Injectable()
export class CardEntitlementsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string, limit: number, cursor?: string): Promise<EntitlementRow[]> {
    const result = await this.database.query<EntitlementRow>(
      `SELECT id, source_type, status, quantity_total, quantity_reserved,
              quantity_consumed, expires_at, created_at, updated_at
       FROM card_entitlements
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR (created_at, id) < (
           SELECT created_at, id FROM card_entitlements WHERE id = $2 AND user_id = $1
         ))
       ORDER BY created_at DESC, id DESC LIMIT $3;`,
      [userId, cursor ?? null, limit],
    );
    return result.rows;
  }

  async reserveBigSender(userId: string, idempotencyKey: string, requestHash: string, quantity: number) {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
        `big-sender:${userId}:${idempotencyKey}`,
      ]);
      const existing = await this.findReservationByIdempotency(client, userId, idempotencyKey);
      if (existing) {
        if (existing.request_hash !== requestHash) this.throwIdempotencyConflict();
        return existing;
      }

      const offer = await client.query<{ id: string; offer_code: string; unit_amount_minor: number; currency: string }>(
        `SELECT offer.id, offer.offer_code, offer.unit_amount_minor, book.currency
         FROM price_offers offer
         JOIN price_books book ON book.id = offer.price_book_id
         WHERE book.status = 'active' AND book.market_country = 'CA' AND book.currency = 'CAD'
           AND offer.catalog_visible = TRUE AND offer.offer_type = 'big_sender'
           AND $1 BETWEEN offer.minimum_quantity AND offer.maximum_quantity
           AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
           AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp())
         ORDER BY offer.version DESC LIMIT 1;`,
        [quantity],
      );
      const selected = offer.rows[0];
      if (!selected) throw new ConflictException({ code: 'PRICE_NOT_AVAILABLE', message: 'No CAD tier is available.' });

      const inserted = await client.query<ReservationRow>(
        `INSERT INTO card_entitlement_reservations
           (user_id, price_offer_id, quantity, unit_amount_minor, total_amount_minor,
            currency, request_hash, idempotency_key, expires_at)
         VALUES (
           $1, $2, $3::smallint, $4::integer, $4::integer * $3::integer,
           $5, $6, $7, clock_timestamp() + INTERVAL '15 minutes'
         )
         RETURNING id, price_offer_id, $8::text AS offer_code, status, quantity,
                   unit_amount_minor, total_amount_minor, currency, request_hash,
                   release_idempotency_key, expires_at, released_at, created_at, updated_at;`,
        [
          userId,
          selected.id,
          quantity,
          selected.unit_amount_minor,
          selected.currency,
          requestHash,
          idempotencyKey,
          selected.offer_code,
        ],
      );
      return this.requireReservation(inserted.rows[0]);
    });
  }

  async getReservation(userId: string, reservationId: string): Promise<ReservationRow> {
    const result = await this.database.query<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS}
       FROM card_entitlement_reservations reservation
       JOIN price_offers offer ON offer.id = reservation.price_offer_id
       WHERE reservation.id = $1 AND reservation.user_id = $2;`,
      [reservationId, userId],
    );
    return this.requireReservation(result.rows[0]);
  }

  async releaseReservation(userId: string, reservationId: string, idempotencyKey: string): Promise<ReservationRow> {
    try {
      return await this.database.transaction(async (client) => {
        const current = await client.query<ReservationRow>(
          `SELECT ${RESERVATION_COLUMNS}
           FROM card_entitlement_reservations reservation
           JOIN price_offers offer ON offer.id = reservation.price_offer_id
           WHERE reservation.id = $1 AND reservation.user_id = $2 FOR UPDATE OF reservation;`,
          [reservationId, userId],
        );
        const reservation = this.requireReservation(current.rows[0]);
        if (reservation.status === 'released') {
          if (reservation.release_idempotency_key !== idempotencyKey) this.throwIdempotencyConflict();
          return reservation;
        }
        if (reservation.status !== 'reserved') {
          throw new ConflictException({
            code: 'RESERVATION_NOT_RELEASABLE',
            message: 'The card reservation can no longer be released.',
          });
        }
        const updated = await client.query<ReservationRow>(
          `UPDATE card_entitlement_reservations reservation
           SET status = 'released', released_at = clock_timestamp(), release_idempotency_key = $3
           FROM price_offers offer
           WHERE reservation.id = $1 AND reservation.user_id = $2
             AND offer.id = reservation.price_offer_id
           RETURNING ${RESERVATION_COLUMNS};`,
          [reservationId, userId, idempotencyKey],
        );
        return this.requireReservation(updated.rows[0]);
      });
    } catch (error: unknown) {
      if (this.postgresCode(error) === '23505') this.throwIdempotencyConflict();
      throw error;
    }
  }

  async authorizeTryRiskFree(userId: string, idempotencyKey: string, requestHash: string) {
    try {
      return await this.database.transaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [`try-risk-free:${userId}`]);
        const existing = await this.findTryRiskFreeByIdempotency(client, userId, idempotencyKey);
        if (existing) {
          if (existing.request_hash !== requestHash) this.throwIdempotencyConflict();
          return { authorization: existing, balance: await this.balance(client, userId) };
        }
        const previouslyUsed = await client.query<{ id: string }>(
          `SELECT id FROM try_risk_free_authorizations WHERE user_id = $1 LIMIT 1;`,
          [userId],
        );
        if (previouslyUsed.rows[0]) {
          throw new ConflictException({
            code: 'TRY_RISK_FREE_ALREADY_USED',
            message: 'Try Risk-Free can be authorized once per account.',
          });
        }
        const offer = await client.query<{
          id: string;
          authorization_amount_minor: number;
          credits_per_card: number;
          currency: string;
        }>(
          `SELECT offer.id, offer.authorization_amount_minor, offer.credits_per_card, book.currency
           FROM price_offers offer
           JOIN price_books book ON book.id = offer.price_book_id
           WHERE book.status = 'active' AND book.market_country = 'CA' AND book.currency = 'CAD'
             AND offer.catalog_visible = TRUE AND offer.offer_code = 'try_risk_free_one_card'
             AND offer.checkout_enabled = FALSE
           ORDER BY offer.version DESC LIMIT 1;`,
        );
        const selected = offer.rows[0];
        if (!selected || selected.authorization_amount_minor !== 999 || selected.credits_per_card !== 10) {
          throw new ConflictException({ code: 'PRICE_NOT_AVAILABLE', message: 'Try Risk-Free is not available.' });
        }
        const inserted = await client.query<TryRiskFreeRow>(
          `WITH authorized_time AS (SELECT clock_timestamp() AS value)
           INSERT INTO try_risk_free_authorizations
             (user_id, price_offer_id, currency, authorized_amount_minor, credits_granted,
              request_hash, idempotency_key, authorized_at, authorization_expires_at)
           SELECT $1, $2, $3, $4, $5, $6, $7, value, value + INTERVAL '5 days'
           FROM authorized_time
           RETURNING ${TRY_RISK_FREE_COLUMNS.replaceAll('auth_record.', '')};`,
          [
            userId,
            selected.id,
            selected.currency,
            selected.authorization_amount_minor,
            selected.credits_per_card,
            requestHash,
            idempotencyKey,
          ],
        );
        const authorization = this.requireTryRiskFree(inserted.rows[0]);
        const entitlement = await client.query<{ id: string }>(
          `INSERT INTO card_entitlements
             (user_id, price_offer_id, source_type, source_id, quantity_total, expires_at, idempotency_key)
           VALUES ($1, $2, 'try_risk_free', $3, 1, clock_timestamp() + INTERVAL '12 months', $4)
           RETURNING id;`,
          [userId, selected.id, authorization.id, `try-risk-free-entitlement:${authorization.id}`],
        );
        const entitlementId = entitlement.rows[0]?.id;
        if (!entitlementId) throw new Error('Try Risk-Free entitlement creation returned no row.');
        await client.query(`UPDATE try_risk_free_authorizations SET entitlement_id = $2 WHERE id = $1;`, [
          authorization.id,
          entitlementId,
        ]);
        await client.query(
          `SELECT * FROM apply_credit_ledger_entry(
             $1, 'purchase_grant', 10, 'try_risk_free_authorization', $2, $3, '{}'::jsonb
           );`,
          [userId, authorization.id, `try-risk-free-credits:${authorization.id}`],
        );
        return {
          authorization: { ...authorization, entitlement_id: entitlementId },
          balance: await this.balance(client, userId),
        };
      });
    } catch (error: unknown) {
      if (this.postgresCode(error) === '23505') this.throwIdempotencyConflict();
      throw error;
    }
  }

  async getTryRiskFree(userId: string, authorizationId: string): Promise<TryRiskFreeRow> {
    const result = await this.database.query<TryRiskFreeRow>(
      `SELECT ${TRY_RISK_FREE_COLUMNS}
       FROM try_risk_free_authorizations auth_record
       WHERE auth_record.id = $1 AND auth_record.user_id = $2;`,
      [authorizationId, userId],
    );
    return this.requireTryRiskFree(result.rows[0]);
  }

  static entitlementToApi(row: EntitlementRow) {
    return {
      id: row.id,
      sourceType: row.source_type,
      status: row.status,
      quantityTotal: row.quantity_total,
      quantityReserved: row.quantity_reserved,
      quantityConsumed: row.quantity_consumed,
      quantityAvailable: row.quantity_total - row.quantity_reserved - row.quantity_consumed,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static reservationToApi(row: ReservationRow) {
    return {
      id: row.id,
      offerId: row.price_offer_id,
      offerCode: row.offer_code,
      status: row.status,
      quantity: row.quantity,
      unitAmountMinor: row.unit_amount_minor,
      totalAmountMinor: row.total_amount_minor,
      currency: row.currency,
      paymentState: 'not_started',
      entitlementGranted: false,
      expiresAt: row.expires_at,
      releasedAt: row.released_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static tryRiskFreeToApi(row: TryRiskFreeRow) {
    return {
      id: row.id,
      entitlementId: row.entitlement_id,
      status: row.status,
      currency: row.currency,
      authorizedAmountMinor: row.authorized_amount_minor,
      capturedAmountMinor: row.captured_amount_minor,
      releasedAmountMinor: row.released_amount_minor,
      creditsGranted: row.credits_granted,
      authorizedAt: row.authorized_at,
      authorizationExpiresAt: row.authorization_expires_at,
      fulfillmentStartedAt: row.fulfillment_started_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      mockMode: true,
      productionEnabled: false,
    };
  }

  private async findReservationByIdempotency(client: PoolClient, userId: string, idempotencyKey: string) {
    const result = await client.query<ReservationRow>(
      `SELECT ${RESERVATION_COLUMNS}
       FROM card_entitlement_reservations reservation
       JOIN price_offers offer ON offer.id = reservation.price_offer_id
       WHERE reservation.user_id = $1 AND reservation.idempotency_key = $2;`,
      [userId, idempotencyKey],
    );
    return result.rows[0];
  }

  private async findTryRiskFreeByIdempotency(client: PoolClient, userId: string, idempotencyKey: string) {
    const result = await client.query<TryRiskFreeRow>(
      `SELECT ${TRY_RISK_FREE_COLUMNS}
       FROM try_risk_free_authorizations auth_record
       WHERE auth_record.user_id = $1 AND auth_record.idempotency_key = $2;`,
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

  private requireReservation(row: ReservationRow | undefined): ReservationRow {
    if (!row) throw new NotFoundException('Card reservation not found.');
    return row;
  }

  private requireTryRiskFree(row: TryRiskFreeRow | undefined): TryRiskFreeRow {
    if (!row) throw new NotFoundException('Try Risk-Free authorization not found.');
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
