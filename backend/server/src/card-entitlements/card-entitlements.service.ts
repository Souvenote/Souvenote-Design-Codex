import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';

type CardEntitlementLedgerRow = {
  id: string;
  user_id: string;
  event_type: string;
  amount: number;
  source: string;
  idempotency_key: string;
  created_at: Date | string;
};

type ExpectedCardEntitlementEntry = {
  userId: string;
  eventType: string;
  amount: number;
  source: string;
  idempotencyKey: string;
};

type CardPackPurchaseRow = {
  id: string;
  offer_code: string;
  status: string;
  amount_cents: number;
  currency: string;
  card_amount: number;
  credit_amount: number;
  checkout_session_id: string | null;
  payment_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class CardEntitlementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBalance(userId: string) {
    return this.findBalanceWith(this.databaseService, userId);
  }

  async findPurchase(userId: string, purchaseId: string) {
    const result = await this.databaseService.query<CardPackPurchaseRow>(
      `
        SELECT
          id,
          offer_code,
          status,
          amount_cents,
          currency,
          card_amount,
          credit_amount,
          checkout_session_id,
          payment_id,
          created_at,
          updated_at
        FROM card_pack_purchases
        WHERE id = $1
          AND user_id = $2
        LIMIT 1;
      `,
      [purchaseId, userId],
    );
    const purchase = result.rows[0];
    if (!purchase) {
      throw new BadRequestException('Card-pack purchase was not found.');
    }
    return {
      purchase: {
        id: purchase.id,
        offerCode: purchase.offer_code,
        status: purchase.status,
        amountCents: purchase.amount_cents,
        currency: purchase.currency,
        cardAmount: purchase.card_amount,
        creditAmount: purchase.credit_amount,
        checkoutSessionId: purchase.checkout_session_id,
        paymentId: purchase.payment_id,
        createdAt: this.toIso(purchase.created_at),
        updatedAt: this.toIso(purchase.updated_at),
      },
      balance: await this.findBalance(userId),
    };
  }

  async grantOnce(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType = 'card_pack_purchase',
  ) {
    return this.grantOnceWith(
      this.databaseService,
      userId,
      amount,
      source,
      idempotencyKey,
      eventType,
    );
  }

  async grantOnceInTransaction(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType = 'card_pack_purchase',
  ) {
    return this.grantOnceWith(
      transaction,
      userId,
      amount,
      source,
      idempotencyKey,
      eventType,
    );
  }

  async deduct(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.databaseService.withTransaction((transaction) =>
      this.deductWith(transaction, userId, amount, source, idempotencyKey),
    );
  }

  async deductInTransaction(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.deductWith(transaction, userId, amount, source, idempotencyKey);
  }

  async reserveGiftInTransaction(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.deductWith(
      transaction,
      userId,
      amount,
      source,
      idempotencyKey,
      'gift_reservation',
    );
  }

  async refundOnce(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.grantOnce(
      userId,
      amount,
      source,
      idempotencyKey,
      'order_refund',
    );
  }

  async refundOnceInTransaction(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.grantOnceInTransaction(
      transaction,
      userId,
      amount,
      source,
      idempotencyKey,
      'order_refund',
    );
  }

  private async deductWith(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType = 'order_deduction',
  ) {
    this.assertPositiveAmount(amount, 'Deduction');
    this.assertText(source, 'source');
    this.assertIdempotencyKey(idempotencyKey);

    const userLock = await transaction.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE;',
      [userId],
    );
    if (userLock.rows.length === 0) {
      throw new BadRequestException('Card-entitlement user was not found.');
    }

    const expected: ExpectedCardEntitlementEntry = {
      userId,
      eventType,
      amount: -amount,
      source,
      idempotencyKey,
    };
    const existing = await this.findIdempotentEntry(
      transaction,
      idempotencyKey,
    );
    if (existing) {
      this.assertMatchingIdempotentEntry(existing, expected);
      return {
        deducted: false,
        ledgerEntry: existing,
        balance: await this.findBalanceWith(transaction, userId),
      };
    }

    const currentBalance = await this.findBalanceWith(transaction, userId);
    if (currentBalance.balance < amount) {
      throw new BadRequestException('Insufficient card entitlements.');
    }

    const insert = await transaction.query<CardEntitlementLedgerRow>(
      `
          INSERT INTO card_entitlement_ledger (
            user_id,
            event_type,
            amount,
            source,
            idempotency_key,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id, user_id, event_type, amount, source, idempotency_key, created_at;
        `,
      [userId, eventType, -amount, source, idempotencyKey, null],
    );
    const ledgerEntry =
      insert.rows[0] ??
      (await this.findIdempotentEntry(transaction, idempotencyKey));
    this.assertMatchingIdempotentEntry(ledgerEntry, expected);

    return {
      deducted: Boolean(insert.rows[0]),
      ledgerEntry,
      balance: await this.findBalanceWith(transaction, userId),
    };
  }

  private async grantOnceWith(
    queryable: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType: string,
  ) {
    this.assertPositiveAmount(amount, 'Grant');
    this.assertText(source, 'source');
    this.assertText(eventType, 'eventType');
    this.assertIdempotencyKey(idempotencyKey);

    const expected: ExpectedCardEntitlementEntry = {
      userId,
      eventType,
      amount,
      source,
      idempotencyKey,
    };
    const result = await queryable.query<CardEntitlementLedgerRow>(
      `
        INSERT INTO card_entitlement_ledger (
          user_id,
          event_type,
          amount,
          source,
          idempotency_key,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id, user_id, event_type, amount, source, idempotency_key, created_at;
      `,
      [userId, eventType, amount, source, idempotencyKey, null],
    );
    const inserted = result.rows[0];
    const ledgerEntry =
      inserted ?? (await this.findIdempotentEntry(queryable, idempotencyKey));
    this.assertMatchingIdempotentEntry(ledgerEntry, expected);

    return {
      granted: Boolean(inserted),
      ledgerEntry,
      balance: await this.findBalanceWith(queryable, userId),
    };
  }

  private async findBalanceWith(
    queryable: DatabaseTransaction,
    userId: string,
  ) {
    const result = await queryable.query<{ balance: string | number }>(
      `
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM card_entitlement_ledger
        WHERE user_id = $1;
      `,
      [userId],
    );
    return {
      userId,
      balance: Number(result.rows[0]?.balance ?? 0),
    };
  }

  private async findIdempotentEntry(
    queryable: DatabaseTransaction,
    idempotencyKey: string,
  ) {
    const result = await queryable.query<CardEntitlementLedgerRow>(
      `
        SELECT id, user_id, event_type, amount, source, idempotency_key, created_at
        FROM card_entitlement_ledger
        WHERE idempotency_key = $1;
      `,
      [idempotencyKey],
    );
    return result.rows[0];
  }

  private assertMatchingIdempotentEntry(
    entry: CardEntitlementLedgerRow | undefined,
    expected: ExpectedCardEntitlementEntry,
  ): asserts entry is CardEntitlementLedgerRow {
    if (!entry) {
      throw new ConflictException(
        'The card-entitlement idempotency key could not be resolved.',
      );
    }
    if (
      entry.user_id !== expected.userId ||
      entry.event_type !== expected.eventType ||
      Number(entry.amount) !== expected.amount ||
      entry.source !== expected.source
    ) {
      throw new ConflictException(
        `Idempotency key ${expected.idempotencyKey} is already used by a different card-entitlement event.`,
      );
    }
  }

  private assertPositiveAmount(amount: number, action: string) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        `${action} amount must be a positive integer.`,
      );
    }
  }

  private assertIdempotencyKey(idempotencyKey: string) {
    if (idempotencyKey.trim().length < 8) {
      throw new BadRequestException(
        'idempotencyKey must contain at least 8 characters.',
      );
    }
  }

  private assertText(value: string, field: string) {
    if (!value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }
  }

  private toIso(value: Date | string) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
