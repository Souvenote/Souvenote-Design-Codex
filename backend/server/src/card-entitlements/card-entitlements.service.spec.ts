import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { CardEntitlementsService } from './card-entitlements.service';

const grantEntry = {
  id: 'card-ledger-grant',
  user_id: 'user-a',
  event_type: 'card_pack_purchase',
  amount: 5,
  source: 'pack-purchase-a',
  idempotency_key: 'card-grant-a',
  created_at: '2026-08-12T12:00:00.000Z',
};

const deductionEntry = {
  id: 'card-ledger-deduction',
  user_id: 'user-a',
  event_type: 'order_deduction',
  amount: -2,
  source: 'order-a',
  idempotency_key: 'card-deduct-a',
  created_at: '2026-08-12T12:01:00.000Z',
};

describe('CardEntitlementsService', () => {
  const query = jest.fn();
  const transactionQuery = jest.fn();
  const transaction = {
    query: transactionQuery,
  } as unknown as DatabaseTransaction;
  const withTransaction = jest.fn(
    <T>(operation: (active: DatabaseTransaction) => Promise<T>) =>
      operation(transaction),
  );
  const databaseService = {
    query,
    withTransaction,
  } as unknown as DatabaseService;
  const service = new CardEntitlementsService(databaseService);

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
  });

  it('returns only the authenticated user balance', async () => {
    query.mockResolvedValueOnce({ rows: [{ balance: '7' }] });

    await expect(service.findBalance('user-a')).resolves.toEqual({
      userId: 'user-a',
      balance: 7,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      ['user-a'],
    );
  });

  it('returns an owner-scoped card-pack purchase with its balance', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'card-purchase-a',
            offer_code: 'big_sender_2_10',
            status: 'paid',
            amount_cents: 4495,
            currency: 'cad',
            card_amount: 5,
            credit_amount: 50,
            checkout_session_id: 'cs_card_a',
            payment_id: 'payment-card-a',
            created_at: '2026-08-12T12:00:00.000Z',
            updated_at: '2026-08-12T12:05:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ balance: '5' }] });

    await expect(
      service.findPurchase('user-a', 'card-purchase-a'),
    ).resolves.toMatchObject({
      purchase: { cardAmount: 5, creditAmount: 50, status: 'paid' },
      balance: { userId: 'user-a', balance: 5 },
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND user_id = $2'),
      ['card-purchase-a', 'user-a'],
    );
  });

  it('returns an existing matching grant without adding cards twice', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [grantEntry] })
      .mockResolvedValueOnce({ rows: [{ balance: '5' }] });

    await expect(
      service.grantOnce('user-a', 5, 'pack-purchase-a', 'card-grant-a'),
    ).resolves.toMatchObject({
      granted: false,
      ledgerEntry: grantEntry,
      balance: { userId: 'user-a', balance: 5 },
    });
  });

  it('rejects an idempotency key used by another entitlement event', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ ...grantEntry, user_id: 'user-b' }],
    });

    await expect(
      service.grantOnce('user-a', 5, 'pack-purchase-a', 'card-grant-a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('locks the user and deducts cards atomically', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance: '5' }] })
      .mockResolvedValueOnce({ rows: [deductionEntry] })
      .mockResolvedValueOnce({ rows: [{ balance: '3' }] });

    await expect(
      service.deduct('user-a', 2, 'order-a', 'card-deduct-a'),
    ).resolves.toMatchObject({
      deducted: true,
      ledgerEntry: deductionEntry,
      balance: { userId: 'user-a', balance: 3 },
    });
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      ['user-a'],
    );
  });

  it('replays a matching deduction without consuming cards twice', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [deductionEntry] })
      .mockResolvedValueOnce({ rows: [{ balance: '3' }] });

    await expect(
      service.deduct('user-a', 2, 'order-a', 'card-deduct-a'),
    ).resolves.toMatchObject({
      deducted: false,
      ledgerEntry: deductionEntry,
      balance: { userId: 'user-a', balance: 3 },
    });
    expect(transactionQuery).toHaveBeenCalledTimes(3);
  });

  it('rejects a deduction against an insufficient locked balance', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance: '1' }] });

    await expect(
      service.deduct('user-a', 2, 'order-a', 'card-deduct-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionQuery).toHaveBeenCalledTimes(3);
  });

  it('requires durable idempotency keys for grants', async () => {
    await expect(
      service.grantOnce('user-a', 1, 'pack-a', 'short'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
