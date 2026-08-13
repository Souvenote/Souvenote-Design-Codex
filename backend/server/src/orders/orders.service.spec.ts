import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PricingService } from '../pricing/pricing.service';
import { CardEntitlementsService } from '../card-entitlements/card-entitlements.service';
import type { DatabaseTransaction } from '../database/database.service';
import { OrderRow, OrdersService } from './orders.service';

describe('OrdersService', () => {
  const address = {
    name: 'Ada Lovelace',
    line1: '1 Example Street',
    city: 'London',
    region: 'London',
    postalCode: 'SW1A 1AA',
    country: 'GB',
  };
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
  const resolveOrderOffer = jest.fn();
  const pricingService = {
    resolveOrderOffer,
  } as unknown as PricingService;
  const deductInTransaction = jest.fn();
  const service = new OrdersService(databaseService, pricingService, {
    deductInTransaction,
  } as unknown as CardEntitlementsService);

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
    deductInTransaction.mockReset().mockResolvedValue(undefined);
    resolveOrderOffer.mockReset();
    resolveOrderOffer.mockResolvedValue({
      id: 'offer-id',
      offer_code: 'try_risk_free_one_card',
      name: 'Try Risk-Free',
      offer_type: 'try_risk_free',
      price_cents: 999,
      currency: 'cad',
      card_count_min: 1,
      card_count_max: 1,
      credits_per_card: 10,
      shipping_included: true,
      metadata: { hold_days: 5 },
    });
  });

  const order: OrderRow = {
    id: 'order-id',
    user_id: 'user-id',
    card_draft_id: 'draft-id',
    selected_asset_id: 'asset-id',
    status: 'pending',
    scribeless_job_id: null,
    tracking_url: null,
    recipient_address: null,
    recipient_addresses: [],
    sender_address: null,
    qr_code_url: null,
    offer_code: 'try_risk_free_one_card',
    amount_cents: 999,
    currency: 'cad',
    quantity: 1,
    pricing_snapshot: {
      offerCode: 'try_risk_free_one_card',
      unitAmountCents: 999,
      quantity: 1,
      totalAmountCents: 999,
      currency: 'cad',
    },
    checkout_session_id: null,
    payment_id: null,
    fulfillment_job_id: null,
    fulfillment_status_updated_at: null,
    created_at: '2026-06-13T16:00:00.000Z',
    updated_at: '2026-06-13T16:00:00.000Z',
  };

  it('allows valid order status transitions', () => {
    expect(() =>
      service.assertOrderStatus(order, ['pending'], 'start checkout'),
    ).not.toThrow();
  });

  it('rejects invalid order status transitions with a clear error', () => {
    expect(() =>
      service.assertOrderStatus(
        { ...order, status: 'fulfilled_mock' },
        ['pending'],
        'start checkout',
      ),
    ).toThrow(BadRequestException);
  });

  it('returns frontend-friendly order fields', () => {
    expect(service.toOrderResponse(order)).toMatchObject({
      id: 'order-id',
      userId: 'user-id',
      cardDraftId: 'draft-id',
      selectedAssetId: 'asset-id',
      status: 'pending',
      amountCents: 999,
      currency: 'cad',
      quantity: 1,
    });
  });

  it('creates an order only after the selected generated image is approved', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-id' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'asset-id' }] })
      .mockResolvedValueOnce({ rows: [order] });

    await expect(
      service.createOrder('user-id', {
        cardDraftId: 'draft-id',
        selectedAssetId: 'asset-id',
        recipientAddress: address,
        senderAddress: address,
      }),
    ).resolves.toMatchObject({ order: { id: 'order-id' } });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('approved_at IS NOT NULL'),
      ['asset-id', 'user-id', 'draft-id'],
    );
    expect(resolveOrderOffer).toHaveBeenCalledWith(undefined, 1);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('pricing_snapshot'),
      expect.arrayContaining(['try_risk_free_one_card', 999, 'cad', 1]),
    );
  });

  it('calculates multi-card totals from the selected catalog tier', async () => {
    resolveOrderOffer.mockResolvedValueOnce({
      id: 'tier-id',
      offer_code: 'big_sender_2_10',
      name: 'Big Sender 2-10 Cards',
      offer_type: 'big_sender',
      price_cents: 899,
      currency: 'CAD',
      card_count_min: 2,
      card_count_max: 10,
      credits_per_card: 10,
      shipping_included: true,
      metadata: {},
    });
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-id' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'asset-id' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...order,
            offer_code: 'big_sender_2_10',
            amount_cents: 4495,
            quantity: 5,
          },
        ],
      });

    await service.createOrder('user-id', {
      cardDraftId: 'draft-id',
      selectedAssetId: 'asset-id',
      offerCode: 'big_sender_2_10',
      quantity: 5,
      recipientAddress: address,
      senderAddress: address,
    });

    expect(resolveOrderOffer).toHaveBeenCalledWith('big_sender_2_10', 5);
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      expect.arrayContaining(['big_sender_2_10', 4495, 'cad', 5]),
    );
  });

  it('creates a zero-charge prepaid delivery and reserves cards atomically', async () => {
    const prepaidOrder = {
      ...order,
      status: 'paid' as const,
      offer_code: 'prepaid_card_delivery',
      amount_cents: 0,
      quantity: 2,
      payment_id: null,
      checkout_session_id: null,
      funding_source: 'card_bank' as const,
      card_entitlements_reserved_at: '2026-08-12T12:00:00.000Z',
      pricing_snapshot: {
        offerCode: 'prepaid_card_delivery',
        printingIncluded: true,
        shippingIncluded: true,
        creditsPerCard: 0,
      },
    };
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-id' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'asset-id' }] });
    transactionQuery
      .mockResolvedValueOnce({ rows: [prepaidOrder] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createOrder('user-id', {
        cardDraftId: 'draft-id',
        selectedAssetId: 'asset-id',
        fundingSource: 'card_bank',
        quantity: 2,
        recipientAddress: address,
        recipientAddresses: [address, address],
        senderAddress: address,
      }),
    ).resolves.toMatchObject({
      order: {
        status: 'paid',
        amountCents: 0,
        fundingSource: 'card_bank',
        paymentId: null,
      },
    });
    expect(resolveOrderOffer).not.toHaveBeenCalled();
    expect(deductInTransaction).toHaveBeenCalledWith(
      transaction,
      'user-id',
      2,
      'order:order-id',
      'order:order-id:card-bank-reservation',
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("'paid'"),
      expect.arrayContaining([2]),
    );
  });

  it('rejects a paid quantity that does not match the frozen recipient list', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-id' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'asset-id' }] });

    await expect(
      service.createOrder('user-id', {
        cardDraftId: 'draft-id',
        selectedAssetId: 'asset-id',
        quantity: 2,
        recipientAddress: address,
        recipientAddresses: [address],
        senderAddress: address,
      }),
    ).rejects.toThrow(
      'The number of recipient addresses must match the priced order quantity.',
    );
    expect(resolveOrderOffer).not.toHaveBeenCalled();
  });

  it('rejects an order when the selected image is not approved and moderation-cleared', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-id' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.createOrder('user-id', {
        cardDraftId: 'draft-id',
        selectedAssetId: 'asset-id',
        recipientAddress: address,
        senderAddress: address,
      }),
    ).rejects.toThrow(
      'Select an approved, moderation-cleared generated image for this order.',
    );
  });

  it('marks fulfillment as started', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...order, status: 'fulfillment_started' }],
    });

    await expect(
      service.markFulfillmentStarted(order.id),
    ).resolves.toMatchObject({
      status: 'fulfillment_started',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('status = $2::text'),
      expect.arrayContaining([order.id, 'fulfillment_started']),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHEN $2::text IN'),
      expect.any(Array),
    );
  });

  it('marks an order as failed in mock mode', async () => {
    query.mockResolvedValueOnce({
      rows: [{ ...order, status: 'failed_mock' }],
    });

    await expect(service.markFailedMock(order.id)).resolves.toMatchObject({
      status: 'failed_mock',
    });
  });
});
