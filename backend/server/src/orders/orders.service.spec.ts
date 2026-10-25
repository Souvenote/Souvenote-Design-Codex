import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrderRow, OrdersService } from './orders.service';

describe('OrdersService', () => {
  const databaseService = {
    query: jest.fn(),
  } as unknown as DatabaseService;
  const service = new OrdersService(databaseService);

  const order: OrderRow = {
    id: 'order-id',
    user_id: 'user-id',
    card_draft_id: 'draft-id',
    selected_asset_id: 'asset-id',
    status: 'pending',
    scribeless_job_id: null,
    tracking_url: null,
    recipient_address: null,
    sender_address: null,
    qr_code_url: null,
    offer_code: 'try_risk_free_one_card',
    amount_cents: 999,
    currency: 'usd',
    checkout_session_id: null,
    payment_id: null,
    fulfillment_job_id: null,
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
      currency: 'usd',
    });
  });

  it('marks fulfillment as started', async () => {
    jest
      .spyOn(databaseService, 'query')
      .mockResolvedValueOnce({ rows: [{ ...order, status: 'fulfillment_started' }] } as never);

    await expect(service.markFulfillmentStarted(order.id)).resolves.toMatchObject(
      {
        status: 'fulfillment_started',
      },
    );
  });

  it('marks an order as failed in mock mode', async () => {
    jest
      .spyOn(databaseService, 'query')
      .mockResolvedValueOnce({ rows: [{ ...order, status: 'failed_mock' }] } as never);

    await expect(service.markFailedMock(order.id)).resolves.toMatchObject({
      status: 'failed_mock',
    });
  });
});
