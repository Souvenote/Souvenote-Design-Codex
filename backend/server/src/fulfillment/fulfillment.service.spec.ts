import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { type OrderRow, OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { PublicCardLinksService } from '../public-card-links/public-card-links.service';
import { FulfillmentProviderRegistry } from './fulfillment-provider.registry';
import {
  FulfillmentSubmissionError,
  type FulfillmentProvider,
} from './fulfillment.provider';
import { FulfillmentService } from './fulfillment.service';

const address = {
  name: 'Ada Lovelace',
  line1: '1 Example Street',
  city: 'London',
  region: 'London',
  postalCode: 'SW1A 1AA',
  country: 'GB',
};

const paidOrder: OrderRow = {
  id: 'order-a',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  selected_asset_id: 'image-a',
  status: 'paid_mock',
  scribeless_job_id: null,
  tracking_url: null,
  recipient_address: address,
  recipient_addresses: [address, { ...address, name: 'Grace Hopper' }],
  sender_address: { ...address, name: 'Souvenote Team' },
  qr_code_url: 'mock://souvenote/qr/image-a',
  offer_code: 'big_sender_2_10',
  amount_cents: 1798,
  currency: 'usd',
  quantity: 2,
  pricing_snapshot: {},
  checkout_session_id: 'mock-checkout-a',
  payment_id: 'payment-a',
  fulfillment_job_id: null,
  fulfillment_status_updated_at: null,
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z',
};

const creatingFulfillment = {
  id: 'fulfillment-a',
  order_id: 'order-a',
  user_id: 'user-a',
  provider_mode: 'mock',
  mock_fulfillment_id: null,
  provider_fulfillment_id: null,
  provider_recipient_ids: [],
  provider_campaign_id: null,
  provider_status: null,
  status: 'creating',
  attempt_number: 1,
  idempotency_key: 'fulfillment:order-a:mock:attempt:1',
  submitted_at: null,
  estimated_delivery: null,
  status_reason: null,
  request_payload: {},
  response_payload: {},
  last_synced_at: null,
  completed_at: null,
  failed_at: null,
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z',
} as const;

describe('FulfillmentService', () => {
  const transactionQuery = jest.fn();
  const transaction = {
    query: transactionQuery,
  } as unknown as DatabaseTransaction;
  const query = jest.fn();
  const withTransaction = jest.fn(
    <T>(operation: (active: DatabaseTransaction) => Promise<T>) =>
      operation(transaction),
  );
  const databaseService = {
    query,
    withTransaction,
  } as unknown as DatabaseService;

  const findOrderRowForUpdate = jest.fn();
  const findOrderRow = jest.fn();
  const assertOrderStatus = jest.fn();
  const markFulfillmentStarted = jest.fn();
  const markFulfilledMock = jest.fn();
  const markFulfillmentState = jest.fn();
  const toOrderResponse = jest.fn((order: OrderRow) => ({
    id: order.id,
    status: order.status,
  }));
  const ordersService = {
    findOrderRowForUpdate,
    findOrderRow,
    assertOrderStatus,
    markFulfillmentStarted,
    markFulfilledMock,
    markFulfillmentState,
    toOrderResponse,
  } as unknown as OrdersService;

  const submit = jest.fn();
  const fetchStatus = jest.fn();
  const provider: FulfillmentProvider = {
    mode: 'mock',
    submit,
    fetchStatus,
  };
  const getActiveProvider = jest.fn(() => provider);
  const getProvider = jest.fn(() => provider);
  const providerRegistry = {
    getActiveProvider,
    getProvider,
  } as unknown as FulfillmentProviderRegistry;
  const createReadUrl = jest.fn();
  const enqueueOrderNotification = jest.fn();
  const service = new FulfillmentService(
    databaseService,
    ordersService,
    providerRegistry,
    { createReadUrl } as unknown as UploadStorageService,
    { get: jest.fn() } as unknown as ConfigService,
    { getOrCreateToken: jest.fn() } as unknown as PublicCardLinksService,
    { enqueueOrderNotification } as unknown as NotificationsService,
  );

  beforeEach(() => {
    transactionQuery.mockReset();
    query.mockReset();
    withTransaction.mockClear();
    findOrderRowForUpdate.mockReset();
    findOrderRow.mockReset();
    assertOrderStatus.mockReset();
    markFulfillmentStarted.mockReset();
    markFulfilledMock.mockReset();
    markFulfillmentState.mockReset();
    toOrderResponse.mockClear();
    submit.mockReset();
    fetchStatus.mockReset();
    getActiveProvider.mockClear();
    getProvider.mockClear();
    createReadUrl.mockReset();
    enqueueOrderNotification.mockReset().mockResolvedValue(undefined);
    findOrderRowForUpdate.mockResolvedValue(paidOrder);
    markFulfillmentStarted.mockResolvedValue({
      ...paidOrder,
      status: 'fulfillment_started',
    });
  });

  it('submits every paid recipient exactly once and completes mock fulfillment', async () => {
    const completed = {
      ...creatingFulfillment,
      mock_fulfillment_id: 'mock_fulfillment_fulfillment-a',
      provider_fulfillment_id: 'mock_fulfillment_fulfillment-a',
      provider_recipient_ids: [
        'mock_recipient_fulfillment-a_1',
        'mock_recipient_fulfillment-a_2',
      ],
      provider_status: 'fulfilled_mock',
      status: 'fulfilled_mock',
      submitted_at: '2026-07-22T12:01:00.000Z',
    } as const;
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_number: 1 }] })
      .mockResolvedValueOnce({ rows: [creatingFulfillment] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...creatingFulfillment, status: 'submitting' }],
      })
      .mockResolvedValueOnce({ rows: [completed] })
      .mockResolvedValueOnce({ rows: [] });
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'image-a',
            asset_type: 'image',
            s3_key: 'mock/image-a.png',
            qr_metadata: {},
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved_mock',
          },
          {
            id: 'message-a',
            asset_type: 'message',
            s3_key: 'mock/message-a.txt',
            qr_metadata: { text: 'Happy birthday!' },
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    submit.mockResolvedValue({
      providerFulfillmentId: 'mock_fulfillment_fulfillment-a',
      providerRecipientIds: [
        'mock_recipient_fulfillment-a_1',
        'mock_recipient_fulfillment-a_2',
      ],
      providerCampaignId: null,
      providerStatus: 'fulfilled_mock',
      estimatedDelivery: '5-7 business days',
      responseMetadata: { mock: true },
    });
    const fulfilledOrder = { ...paidOrder, status: 'fulfilled_mock' } as const;
    markFulfilledMock.mockResolvedValue(fulfilledOrder);

    await expect(
      service.submitFulfillment('user-a', { orderId: 'order-a' }),
    ).resolves.toMatchObject({
      fulfillment: {
        id: 'fulfillment-a',
        status: 'fulfilled_mock',
        providerRecipientIds: [
          'mock_recipient_fulfillment-a_1',
          'mock_recipient_fulfillment-a_2',
        ],
      },
      order: { status: 'fulfilled_mock' },
      idempotentReplay: false,
    });
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-a',
        recipients: [
          expect.objectContaining({ externalId: 'order-a:1' }),
          expect.objectContaining({ externalId: 'order-a:2' }),
        ],
      }),
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('status = $6::text'),
      expect.any(Array),
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHEN $6::text IN'),
      expect.any(Array),
    );
  });

  it('safely resumes an interrupted mock submission without creating a second attempt', async () => {
    const submitting = {
      ...creatingFulfillment,
      status: 'submitting',
    } as const;
    const completed = {
      ...submitting,
      mock_fulfillment_id: 'mock_fulfillment_fulfillment-a',
      provider_fulfillment_id: 'mock_fulfillment_fulfillment-a',
      provider_recipient_ids: [
        'mock_recipient_fulfillment-a_1',
        'mock_recipient_fulfillment-a_2',
      ],
      provider_status: 'fulfilled_mock',
      status: 'fulfilled_mock',
      submitted_at: '2026-07-22T12:01:00.000Z',
    } as const;
    transactionQuery
      .mockResolvedValueOnce({ rows: [submitting] })
      .mockResolvedValueOnce({ rows: [submitting] })
      .mockResolvedValueOnce({ rows: [completed] })
      .mockResolvedValueOnce({ rows: [] });
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'image-a',
            asset_type: 'image',
            s3_key: 'mock/image-a.png',
            qr_metadata: {},
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved_mock',
          },
          {
            id: 'message-a',
            asset_type: 'message',
            s3_key: 'mock/message-a.txt',
            qr_metadata: { text: 'Happy birthday!' },
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    submit.mockResolvedValue({
      providerFulfillmentId: 'mock_fulfillment_fulfillment-a',
      providerRecipientIds: [
        'mock_recipient_fulfillment-a_1',
        'mock_recipient_fulfillment-a_2',
      ],
      providerCampaignId: null,
      providerStatus: 'fulfilled_mock',
      estimatedDelivery: '5-7 business days',
      responseMetadata: { mock: true },
    });
    markFulfilledMock.mockResolvedValue({
      ...paidOrder,
      status: 'fulfilled_mock',
    });

    await expect(
      service.submitFulfillment('user-a', { orderId: 'order-a' }),
    ).resolves.toMatchObject({
      fulfillment: { status: 'fulfilled_mock' },
      order: { status: 'fulfilled_mock' },
      idempotentReplay: false,
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(markFulfillmentStarted).not.toHaveBeenCalled();
  });

  it('does not submit again when a durable attempt already succeeded', async () => {
    const completed = {
      ...creatingFulfillment,
      provider_fulfillment_id: 'mock_fulfillment_fulfillment-a',
      provider_recipient_ids: ['recipient-a', 'recipient-b'],
      status: 'fulfilled_mock',
    } as const;
    transactionQuery.mockResolvedValueOnce({ rows: [completed] });

    await expect(
      service.submitFulfillment('user-a', { orderId: 'order-a' }),
    ).resolves.toMatchObject({ idempotentReplay: true });
    expect(submit).not.toHaveBeenCalled();
  });

  it('puts an ambiguous provider outcome on hold instead of allowing a duplicate retry', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_number: 1 }] })
      .mockResolvedValueOnce({ rows: [creatingFulfillment] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...creatingFulfillment, status: 'submission_unknown' }],
      })
      .mockResolvedValueOnce({ rows: [] });
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'image-a',
            asset_type: 'image',
            s3_key: 'mock/image-a.png',
            qr_metadata: {},
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved_mock',
          },
          {
            id: 'message-a',
            asset_type: 'message',
            s3_key: 'mock/message-a.txt',
            qr_metadata: { text: 'Happy birthday!' },
            approved_at: '2026-07-22T11:00:00.000Z',
            moderation_state: 'approved',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    submit.mockRejectedValue(
      new FulfillmentSubmissionError('Provider timed out.', true),
    );
    markFulfillmentState.mockResolvedValue({
      ...paidOrder,
      status: 'fulfillment_on_hold',
    });

    await expect(
      service.submitFulfillment('user-a', { orderId: 'order-a' }),
    ).rejects.toThrow(BadGatewayException);
    expect(markFulfillmentState).toHaveBeenCalledWith(
      'order-a',
      'fulfillment_on_hold',
      { fulfillmentJobId: 'fulfillment-a' },
      transaction,
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('status = $2::text'),
      expect.any(Array),
    );
  });

  it('resumes an interrupted mock submission when its status is refreshed', async () => {
    const submitting = {
      ...creatingFulfillment,
      status: 'submitting',
    } as const;
    const resumed = {
      fulfillment: {
        id: 'fulfillment-a',
        status: 'fulfilled_mock',
      },
      order: {
        id: 'order-a',
        status: 'fulfilled_mock',
      },
      idempotentReplay: false,
    };
    findOrderRow.mockResolvedValue({
      ...paidOrder,
      status: 'fulfillment_started',
    });
    query.mockResolvedValueOnce({ rows: [submitting] });
    const resumeSpy = jest
      .spyOn(service, 'submitFulfillment')
      .mockResolvedValue(resumed as never);

    await expect(
      service.refreshFulfillmentByOrder('user-a', 'order-a'),
    ).resolves.toEqual(resumed);
    expect(resumeSpy).toHaveBeenCalledWith('user-a', { orderId: 'order-a' });
    resumeSpy.mockRestore();
  });

  it('does not regress a printing order when Scribeless later reports ready', async () => {
    const printingFulfillment = {
      ...creatingFulfillment,
      provider_mode: 'scribeless',
      provider_fulfillment_id: 'recipient-a',
      provider_recipient_ids: ['recipient-a', 'recipient-b'],
      provider_campaign_id: 'campaign-a',
      provider_status: 'in_progress',
      status: 'printing',
    } as const;
    const printingOrder = { ...paidOrder, status: 'printing' } as const;
    findOrderRow.mockResolvedValue(printingOrder);
    findOrderRowForUpdate.mockResolvedValue(printingOrder);
    query.mockResolvedValueOnce({ rows: [printingFulfillment] });
    transactionQuery
      .mockResolvedValueOnce({ rows: [printingFulfillment] })
      .mockResolvedValueOnce({
        rows: [{ ...printingFulfillment, provider_status: 'ready' }],
      });
    fetchStatus.mockResolvedValue({
      providerStatus: 'ready',
      recipientStatuses: [
        { id: 'recipient-a', status: 'ready', isRendered: true },
        { id: 'recipient-b', status: 'ready', isRendered: true },
      ],
      responseMetadata: { recipientCount: 2 },
    });
    markFulfillmentState.mockResolvedValue(printingOrder);

    await expect(
      service.refreshFulfillmentByOrder('user-a', 'order-a'),
    ).resolves.toMatchObject({
      fulfillment: { status: 'printing', providerStatus: 'ready' },
      order: { status: 'printing' },
    });
    expect(fetchStatus).toHaveBeenCalledWith(['recipient-a', 'recipient-b']);
    expect(markFulfillmentState).toHaveBeenCalledWith(
      'order-a',
      'printing',
      expect.objectContaining({ fulfillmentJobId: 'fulfillment-a' }),
      transaction,
    );
  });

  it('enqueues a shipping update only when reconciliation advances to shipped', async () => {
    const printingFulfillment = {
      ...creatingFulfillment,
      provider_mode: 'scribeless',
      provider_fulfillment_id: 'fulfillment-a',
      provider_recipient_ids: ['recipient-a', 'recipient-b'],
      provider_campaign_id: 'campaign-a',
      provider_status: 'printing',
      status: 'printing',
    } as const;
    const shippedFulfillment = {
      ...printingFulfillment,
      provider_status: 'shipped',
      status: 'shipped',
    } as const;
    const printingOrder = { ...paidOrder, status: 'printing' } as const;
    const shippedOrder = { ...paidOrder, status: 'shipped' } as const;
    findOrderRow.mockResolvedValue(printingOrder);
    findOrderRowForUpdate.mockResolvedValue(printingOrder);
    query.mockResolvedValueOnce({ rows: [printingFulfillment] });
    transactionQuery
      .mockResolvedValueOnce({ rows: [printingFulfillment] })
      .mockResolvedValueOnce({ rows: [shippedFulfillment] })
      .mockResolvedValueOnce({ rows: [] });
    fetchStatus.mockResolvedValue({
      providerStatus: 'shipped',
      recipientStatuses: [
        { id: 'recipient-a', status: 'shipped', isRendered: true },
        { id: 'recipient-b', status: 'shipped', isRendered: true },
      ],
      responseMetadata: { recipientCount: 2 },
    });
    markFulfillmentState.mockResolvedValue(shippedOrder);

    await service.refreshFulfillmentByOrder('user-a', 'order-a');

    expect(enqueueOrderNotification).toHaveBeenCalledWith(transaction, {
      eventType: 'order_shipped',
      userId: 'user-a',
      orderId: 'order-a',
      orderStatus: 'shipped',
      quantity: 2,
      amountCents: 1798,
      currency: 'usd',
    });
  });
});
