import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';

type LedgerEntryRow = {
  id: string;
  user_id: string;
  event_type: string;
  amount: number;
  source: string;
  idempotency_key: string;
  created_at: Date | string;
};

type CreditPackPurchaseRow = {
  id: string;
  offer_code: string;
  status: string;
  amount_cents: number;
  currency: string;
  credit_amount: number;
  checkout_session_id: string | null;
  payment_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class CreditsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBalance(userId: string) {
    return this.findBalanceWith(this.databaseService, userId);
  }

  async findPurchase(userId: string, purchaseId: string) {
    const result = await this.databaseService.query<CreditPackPurchaseRow>(
      `
        SELECT
          id,
          offer_code,
          status,
          amount_cents,
          currency,
          credit_amount,
          checkout_session_id,
          payment_id,
          created_at,
          updated_at
        FROM credit_pack_purchases
        WHERE id = $1
          AND user_id = $2
        LIMIT 1;
      `,
      [purchaseId, userId],
    );
    const purchase = result.rows[0];
    if (!purchase) {
      throw new BadRequestException('Credit-pack purchase was not found.');
    }
    return {
      purchase: {
        id: purchase.id,
        offerCode: purchase.offer_code,
        status: purchase.status,
        amountCents: purchase.amount_cents,
        currency: purchase.currency,
        creditAmount: purchase.credit_amount,
        checkoutSessionId: purchase.checkout_session_id,
        paymentId: purchase.payment_id,
        createdAt: this.toIso(purchase.created_at),
        updatedAt: this.toIso(purchase.updated_at),
      },
      balance: await this.findBalance(userId),
    };
  }

  async grant(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    const result = await this.grantOnce(
      userId,
      amount,
      source,
      idempotencyKey,
      'manual_grant',
    );

    return {
      ledgerEntry: result.ledgerEntry,
      balance: result.balance,
    };
  }

  async grantOnce(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType = 'manual_grant',
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
    eventType = 'manual_grant',
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

  private async grantOnceWith(
    queryable: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType: string,
  ) {
    this.assertPositiveAmount(amount, 'Grant');
    this.assertIdempotencyKey(idempotencyKey);

    const result = await queryable.query<LedgerEntryRow>(
      `
        INSERT INTO credit_ledger (
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

    this.assertMatchingIdempotentEntry(ledgerEntry, {
      userId,
      eventType,
      amount,
      source,
      idempotencyKey,
    });

    return {
      granted: Boolean(inserted),
      ledgerEntry,
      balance: await this.findBalanceWith(queryable, userId),
    };
  }

  async deduct(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.databaseService.withTransaction((transaction) =>
      this.deductOnceWith(
        transaction,
        userId,
        amount,
        source,
        idempotencyKey,
        'generation_deduction',
      ),
    );
  }

  async reserveGiftInTransaction(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    return this.deductOnceWith(
      transaction,
      userId,
      amount,
      source,
      idempotencyKey,
      'gift_reservation',
    );
  }

  private async deductOnceWith(
    transaction: DatabaseTransaction,
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
    eventType: string,
  ) {
    this.assertPositiveAmount(amount, 'Deduction');
    this.assertIdempotencyKey(idempotencyKey);
    const userLock = await transaction.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE;',
      [userId],
    );
    if (userLock.rows.length === 0) {
      throw new BadRequestException('Credit user was not found.');
    }
    const expected = {
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
      throw new BadRequestException('Insufficient credits.');
    }
    const insert = await transaction.query<LedgerEntryRow>(
      `
        INSERT INTO credit_ledger (
          user_id, event_type, amount, source, idempotency_key, metadata
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

  async refund(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    this.assertPositiveAmount(amount, 'Refund');
    const result = await this.grantOnce(
      userId,
      amount,
      source,
      idempotencyKey,
      'generation_refund',
    );

    return {
      ledgerEntry: result.ledgerEntry,
      balance: result.balance,
    };
  }

  private async findBalanceWith(
    queryable: DatabaseTransaction,
    userId: string,
  ) {
    const result = await queryable.query<{ balance: string | number }>(
      `
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM credit_ledger
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
    const result = await queryable.query<LedgerEntryRow>(
      `
        SELECT id, user_id, event_type, amount, source, idempotency_key, created_at
        FROM credit_ledger
        WHERE idempotency_key = $1;
      `,
      [idempotencyKey],
    );

    return result.rows[0];
  }

  private assertMatchingIdempotentEntry(
    entry: LedgerEntryRow | undefined,
    expected: {
      userId: string;
      eventType: string;
      amount: number;
      source: string;
      idempotencyKey: string;
    },
  ): asserts entry is LedgerEntryRow {
    if (!entry) {
      throw new ConflictException(
        'The credit idempotency key could not be resolved.',
      );
    }

    if (
      entry.user_id !== expected.userId ||
      entry.event_type !== expected.eventType ||
      Number(entry.amount) !== expected.amount ||
      entry.source !== expected.source
    ) {
      throw new ConflictException(
        `Idempotency key ${expected.idempotencyKey} is already used by a different credit event.`,
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
    if (!idempotencyKey.trim()) {
      throw new BadRequestException('idempotencyKey is required.');
    }
  }

  private toIso(value: Date | string) {
    return value instanceof Date ? value.toISOString() : value;
  }
}
