import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { CreditsService } from './credits.service';

const existingGrant = {
  id: 'ledger-grant',
  user_id: 'user-a',
  event_type: 'credit_purchase',
  amount: 10,
  source: 'mock_checkout_purchase',
  idempotency_key: 'purchase-key',
  created_at: '2026-07-22T12:00:00.000Z',
};

const existingDeduction = {
  id: 'ledger-deduction',
  user_id: 'user-a',
  event_type: 'generation_deduction',
  amount: -2,
  source: 'mock_generation',
  idempotency_key: 'generation-key',
  created_at: '2026-07-22T12:00:00.000Z',
};

describe('CreditsService', () => {
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
  const service = new CreditsService(databaseService);

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
  });

  it('returns a standalone purchase only through its owner scope', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'credit-purchase-a',
            offer_code: 'credit_pack_creator_80',
            status: 'paid',
            amount_cents: 1000,
            currency: 'cad',
            credit_amount: 80,
            checkout_session_id: 'cs_credit_a',
            payment_id: 'credit-payment-a',
            created_at: '2026-07-23T12:00:00.000Z',
            updated_at: '2026-07-23T12:01:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ balance: '80' }] });

    await expect(
      service.findPurchase('user-a', 'credit-purchase-a'),
    ).resolves.toMatchObject({
      purchase: {
        id: 'credit-purchase-a',
        status: 'paid',
        amountCents: 1000,
        currency: 'cad',
        creditAmount: 80,
      },
      balance: { userId: 'user-a', balance: 80 },
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND user_id = $2'),
      ['credit-purchase-a', 'user-a'],
    );
  });

  it('does not reveal a standalone purchase outside the owner scope', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.findPurchase('user-b', 'credit-purchase-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an existing matching grant without adding credits twice', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existingGrant] })
      .mockResolvedValueOnce({ rows: [{ balance: '10' }] });

    await expect(
      service.grantOnce(
        'user-a',
        10,
        'mock_checkout_purchase',
        'purchase-key',
        'credit_purchase',
      ),
    ).resolves.toMatchObject({
      granted: false,
      ledgerEntry: existingGrant,
      balance: { userId: 'user-a', balance: 10 },
    });
  });

  it('rejects an idempotency key already used by another credit event', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ ...existingGrant, user_id: 'user-b' }],
    });

    await expect(
      service.grantOnce(
        'user-a',
        10,
        'mock_checkout_purchase',
        'purchase-key',
        'credit_purchase',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('locks the user and deducts against the latest balance atomically', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance: '5' }] })
      .mockResolvedValueOnce({ rows: [existingDeduction] })
      .mockResolvedValueOnce({ rows: [{ balance: '3' }] });

    await expect(
      service.deduct('user-a', 2, 'mock_generation', 'generation-key'),
    ).resolves.toMatchObject({
      ledgerEntry: existingDeduction,
      balance: { userId: 'user-a', balance: 3 },
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      ['user-a'],
    );
  });

  it('returns a prior matching deduction without charging again', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [existingDeduction] })
      .mockResolvedValueOnce({ rows: [{ balance: '3' }] });

    await expect(
      service.deduct('user-a', 2, 'mock_generation', 'generation-key'),
    ).resolves.toMatchObject({
      ledgerEntry: existingDeduction,
      balance: { userId: 'user-a', balance: 3 },
    });

    expect(transactionQuery).toHaveBeenCalledTimes(3);
  });

  it('rejects a deduction when the locked balance is insufficient', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance: '1' }] });

    await expect(
      service.deduct('user-a', 2, 'mock_generation', 'generation-key'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transactionQuery).toHaveBeenCalledTimes(3);
  });
});
