import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreditsService } from '../credits/credits.service';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { type OrderRow, OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import type { CheckoutProvider } from './checkout.provider';
import { CheckoutService } from './checkout.service';

const pendingOrder: OrderRow = {
  id: 'order-a',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  selected_asset_id: 'asset-a',
  status: 'pending',
  scribeless_job_id: null,
  tracking_url: null,
  recipient_address: {},
  recipient_addresses: [{}],
  sender_address: {},
  qr_code_url: 'mock://souvenote/qr/asset-a',
  offer_code: 'try_risk_free_one_card',
  amount_cents: 999,
  currency: 'cad',
  quantity: 1,
  pricing_snapshot: {
    offerCode: 'try_risk_free_one_card',
    name: 'Try Risk-Free',
    unitAmountCents: 999,
    metadata: {
      hold_days: 5,
      decision_window_starts_at: 'payment_authorized',
      no_send_fee_cents: 200,
    },
  },
  checkout_session_id: null,
  payment_id: null,
  fulfillment_job_id: null,
  fulfillment_status_updated_at: null,
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z',
};

const creatingPayment = {
  id: 'payment-a',
  user_id: 'user-a',
  order_id: 'order-a',
  credit_pack_purchase_id: null,
  stripe_payment_intent_id: null,
  offer_code: 'try_risk_free_one_card',
  amount_cents: 999,
  currency: 'cad',
  status: 'creating',
  metadata: {},
  provider_mode: 'stripe',
  checkout_session_id: null,
  capture_method: 'manual',
  attempt_number: 1,
  idempotency_key: 'checkout:order-a:stripe:attempt:1',
  amount_captured_cents: 0,
  finalization_action: null,
  expires_at: null,
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z',
} as const;

const startedPayment = {
  ...creatingPayment,
  status: 'checkout_started',
  checkout_session_id: 'cs_test_a',
  metadata: {
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_a',
  },
};

const pendingCreditPackPurchase = {
  id: 'credit-purchase-a',
  user_id: 'user-a',
  pricing_catalog_id: 'pricing-credit-a',
  offer_code: 'credit_pack_creator_80',
  status: 'pending',
  amount_cents: 1000,
  currency: 'cad',
  credit_amount: 80,
  pricing_snapshot: {
    offerCode: 'credit_pack_creator_80',
    name: 'Creator Credits',
    type: 'credit_pack',
    priceCents: 1000,
    currency: 'cad',
    creditAmount: 80,
    source: 'pricing_catalog',
  },
  idempotency_key: 'credit-request-a',
  checkout_session_id: null,
  payment_id: null,
  created_at: '2026-07-23T12:00:00.000Z',
  updated_at: '2026-07-23T12:00:00.000Z',
} as const;

const creatingCreditPackPayment = {
  id: 'credit-payment-a',
  user_id: 'user-a',
  order_id: null,
  credit_pack_purchase_id: 'credit-purchase-a',
  stripe_payment_intent_id: null,
  offer_code: 'credit_pack_creator_80',
  amount_cents: 1000,
  currency: 'cad',
  status: 'creating',
  metadata: {},
  provider_mode: 'stripe',
  checkout_session_id: null,
  capture_method: 'automatic_async',
  attempt_number: 1,
  idempotency_key: 'credit-checkout:credit-purchase-a:stripe:attempt:1',
  amount_captured_cents: 0,
  finalization_action: null,
  expires_at: null,
  created_at: '2026-07-23T12:00:00.000Z',
  updated_at: '2026-07-23T12:00:00.000Z',
} as const;

const startedCreditPackPayment = {
  ...creatingCreditPackPayment,
  status: 'checkout_started',
  checkout_session_id: 'cs_credit_a',
  metadata: {
    checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_credit_a',
  },
};

const startedCreditPackPurchase = {
  ...pendingCreditPackPurchase,
  status: 'checkout_started',
  checkout_session_id: 'cs_credit_a',
  payment_id: 'credit-payment-a',
};

describe('CheckoutService', () => {
  const transactionQuery = jest.fn();
  const transaction = {
    query: transactionQuery,
  } as unknown as DatabaseTransaction;
  const withTransaction = jest.fn(
    <T>(operation: (active: DatabaseTransaction) => Promise<T>) =>
      operation(transaction),
  );
  const databaseQuery = jest.fn();
  const databaseService = {
    withTransaction,
    query: databaseQuery,
  } as unknown as DatabaseService;

  const findOrderRowForUpdate = jest.fn();
  const assertOrderStatus = jest.fn();
  const markCheckoutStarted = jest.fn();
  const markPaidMock = jest.fn();
  const markPaymentState = jest.fn();
  const toOrderResponse = jest.fn((order: OrderRow) => ({
    id: order.id,
    status: order.status,
  }));
  const ordersService = {
    findOrderRowForUpdate,
    assertOrderStatus,
    markCheckoutStarted,
    markPaidMock,
    markPaymentState,
    toOrderResponse,
  } as unknown as OrdersService;

  const createSession = jest.fn();
  const capturePayment = jest.fn();
  const cancelPayment = jest.fn();
  const stripeProvider: CheckoutProvider = {
    mode: 'stripe',
    createSession,
    capturePayment,
    cancelPayment,
  };
  const getActiveProvider = jest.fn();
  const getStripeProvider = jest.fn();
  const providerRegistry = {
    getActiveProvider,
    getStripeProvider,
  } as unknown as CheckoutProviderRegistry;
  const getConfig = jest.fn((key: string) => {
    if (key === 'CHECKOUT_SUCCESS_URL') {
      return 'https://app.example.com/delivery?session_id={CHECKOUT_SESSION_ID}';
    }
    if (key === 'CHECKOUT_CANCEL_URL') {
      return 'https://app.example.com/delivery?checkout=cancel';
    }
    if (key === 'CREDIT_CHECKOUT_SUCCESS_URL') {
      return 'https://app.example.com/cart?session_id={CHECKOUT_SESSION_ID}';
    }
    if (key === 'CREDIT_CHECKOUT_CANCEL_URL') {
      return 'https://app.example.com/cart?checkout=cancel';
    }
    return undefined;
  });
  const enqueueOrderNotification = jest.fn();
  const checkoutStarted = jest.fn();
  const orderConfirmed = jest.fn();
  const grantOnceInTransaction = jest.fn();
  const findBalance = jest.fn();
  const resolveCreditPackOffer = jest.fn();
  const service = new CheckoutService(
    databaseService,
    ordersService,
    providerRegistry,
    { get: getConfig } as unknown as ConfigService,
    { enqueueOrderNotification } as unknown as NotificationsService,
    {
      grantOnceInTransaction,
      findBalance,
    } as unknown as CreditsService,
    { resolveCreditPackOffer } as unknown as PricingService,
    {
      checkoutStarted,
      orderConfirmed,
    } as unknown as AnalyticsService,
  );

  beforeEach(() => {
    transactionQuery.mockReset();
    databaseQuery.mockReset();
    withTransaction.mockClear();
    findOrderRowForUpdate.mockReset();
    assertOrderStatus.mockReset();
    markCheckoutStarted.mockReset();
    markPaidMock.mockReset();
    markPaymentState.mockReset();
    toOrderResponse.mockClear();
    createSession.mockReset();
    capturePayment.mockReset();
    cancelPayment.mockReset();
    getActiveProvider.mockReset();
    getStripeProvider.mockReset();
    getConfig.mockClear();
    enqueueOrderNotification.mockReset().mockResolvedValue(undefined);
    checkoutStarted.mockReset().mockResolvedValue(undefined);
    orderConfirmed.mockReset().mockResolvedValue(undefined);
    grantOnceInTransaction.mockReset();
    findBalance.mockReset();
    resolveCreditPackOffer.mockReset();
    getActiveProvider.mockReturnValue(stripeProvider);
    findOrderRowForUpdate.mockResolvedValue(pendingOrder);
    markCheckoutStarted.mockResolvedValue({
      ...pendingOrder,
      status: 'checkout_started',
      checkout_session_id: 'cs_test_a',
      payment_id: 'payment-a',
    });
  });

  it('enqueues one safe order confirmation in the mock payment transaction', async () => {
    const checkoutOrder = {
      ...pendingOrder,
      status: 'checkout_started',
      checkout_session_id: 'mock_checkout_a',
    } as const;
    const paidOrder = { ...checkoutOrder, status: 'paid_mock' } as const;
    findOrderRowForUpdate.mockResolvedValue(checkoutOrder);
    markPaidMock.mockResolvedValue(paidOrder);
    getActiveProvider.mockReturnValue({
      mode: 'mock',
      createSession,
    });
    transactionQuery
      .mockResolvedValueOnce({
        rows: [
          {
            ...startedPayment,
            provider_mode: 'mock',
            checkout_session_id: 'mock_checkout_a',
            status: 'succeeded_mock',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.simulateCheckoutSuccess('user-a', {
      orderId: 'order-a',
      checkoutSessionId: 'mock_checkout_a',
    });

    expect(enqueueOrderNotification).toHaveBeenCalledWith(transaction, {
      eventType: 'order_confirmation',
      userId: 'user-a',
      orderId: 'order-a',
      orderStatus: 'paid_mock',
      quantity: 1,
      amountCents: 999,
      currency: 'cad',
    });
    expect(orderConfirmed).toHaveBeenCalledWith('user-a', 'order-a', {
      providerMode: 'mock',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'cad',
    });
  });

  it('starts a server-priced Stripe authorization with a durable idempotency key', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_number: 1 }] })
      .mockResolvedValueOnce({ rows: [creatingPayment] })
      .mockResolvedValueOnce({
        rows: [
          {
            email: 'user@example.com',
            stripe_customer_id: 'cus_a',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [startedPayment] })
      .mockResolvedValueOnce({ rows: [] });
    createSession.mockResolvedValue({
      sessionId: 'cs_test_a',
      paymentIntentId: null,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_a',
      expiresAt: new Date('2026-07-22T12:30:00.000Z'),
      providerMetadata: { amountSubtotal: 999 },
    });

    await expect(
      service.startCheckout('user-a', { orderId: 'order-a' }),
    ).resolves.toMatchObject({
      checkoutSession: {
        id: 'cs_test_a',
        providerMode: 'stripe',
        captureMethod: 'manual',
      },
      order: { status: 'checkout_started' },
      idempotentReplay: false,
    });

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        localPaymentId: 'payment-a',
        unitAmountCents: 999,
        totalAmountCents: 999,
        quantity: 1,
        captureMethod: 'manual',
        idempotencyKey: 'checkout:order-a:stripe:attempt:1',
      }),
    );
    expect(markCheckoutStarted).toHaveBeenCalledWith(
      'order-a',
      'cs_test_a',
      'payment-a',
      transaction,
    );
    expect(checkoutStarted).toHaveBeenCalledWith('user-a', 'order-a', {
      providerMode: 'stripe',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'cad',
    });
  });

  it('tracks a reconciled paid Stripe order only after the transaction commits', async () => {
    const event = {
      id: 'evt_paid',
      type: 'payment_intent.succeeded',
      livemode: false,
      api_version: '2026-06-24.dahlia',
      created: 1_800_000_000,
      data: {
        object: {
          id: 'pi_a',
          metadata: {
            souvenotePaymentId: 'payment-a',
            souvenoteOrderId: 'order-a',
          },
          status: 'succeeded',
          amount: 999,
          amount_capturable: 0,
          amount_received: 999,
          currency: 'cad',
        },
      },
    } as unknown as Stripe.Event;
    getStripeProvider.mockReturnValue({
      constructWebhookEvent: jest.fn().mockReturnValue(event),
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ event_id: 'evt_paid' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...startedPayment,
            stripe_payment_intent_id: 'pi_a',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'payment-a' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'order-a',
            user_id: 'user-a',
            status: 'paid',
            quantity: 1,
            amount_cents: 999,
            currency: 'cad',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    databaseQuery.mockResolvedValue({
      rows: [
        {
          id: 'order-a',
          user_id: 'user-a',
          offer_code: 'try_risk_free_one_card',
          quantity: 1,
          currency: 'cad',
          provider_mode: 'stripe',
        },
      ],
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'signature');

    expect(enqueueOrderNotification).toHaveBeenCalledTimes(1);
    expect(databaseQuery).toHaveBeenCalledTimes(1);
    expect(orderConfirmed).toHaveBeenCalledWith('user-a', 'order-a', {
      providerMode: 'stripe',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'cad',
    });
  });

  it('replays an existing started session without another provider call', async () => {
    findOrderRowForUpdate.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'checkout_started',
      checkout_session_id: 'cs_test_a',
      payment_id: 'payment-a',
    });
    transactionQuery.mockResolvedValueOnce({ rows: [startedPayment] });

    await expect(
      service.startCheckout('user-a', { orderId: 'order-a' }),
    ).resolves.toMatchObject({
      checkoutSession: { id: 'cs_test_a' },
      idempotentReplay: true,
    });

    expect(createSession).not.toHaveBeenCalled();
    expect(transactionQuery).toHaveBeenCalledTimes(1);
  });

  it('marks a failed provider attempt so a later checkout can retry', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_number: 1 }] })
      .mockResolvedValueOnce({ rows: [creatingPayment] })
      .mockResolvedValueOnce({
        rows: [{ email: 'user@example.com', stripe_customer_id: null }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'payment-a' }] });
    createSession.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.startCheckout('user-a', { orderId: 'order-a' }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(markPaymentState).toHaveBeenCalledWith(
      'order-a',
      'payment_failed',
      'payment-a',
      transaction,
    );
  });

  it('deduplicates a repeated signed Stripe webhook event', async () => {
    const constructWebhookEvent = jest.fn().mockReturnValue({
      id: 'evt_a',
      type: 'payment_intent.succeeded',
      livemode: false,
      api_version: '2026-06-24.dahlia',
      created: 1_800_000_000,
      data: { object: { id: 'pi_a' } },
    });
    getStripeProvider.mockReturnValue({ constructWebhookEvent });
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'signature'),
    ).resolves.toEqual({
      received: true,
      duplicate: true,
      eventId: 'evt_a',
    });

    expect(transactionQuery).toHaveBeenCalledTimes(2);
  });

  it('atomically reconciles an authorized PaymentIntent and audits it', async () => {
    const event = {
      id: 'evt_authorized',
      type: 'payment_intent.amount_capturable_updated',
      livemode: false,
      api_version: '2026-06-24.dahlia',
      created: 1_800_000_000,
      data: {
        object: {
          id: 'pi_a',
          metadata: {
            souvenotePaymentId: 'payment-a',
            souvenoteOrderId: 'order-a',
          },
          status: 'requires_capture',
          amount: 1099,
          amount_capturable: 1099,
          amount_received: 0,
          currency: 'cad',
        },
      },
    } as unknown as Stripe.Event;
    getStripeProvider.mockReturnValue({
      constructWebhookEvent: jest.fn().mockReturnValue(event),
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ event_id: 'evt_authorized' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...startedPayment,
            stripe_payment_intent_id: 'pi_a',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ pricing_snapshot: pendingOrder.pricing_snapshot }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'payment-a' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'order-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'signature'),
    ).resolves.toMatchObject({ received: true, duplicate: false });

    expect(transactionQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('decision_due_at'),
      expect.arrayContaining([
        new Date((1_800_000_000 + 5 * 24 * 60 * 60) * 1000),
      ]),
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('UPDATE orders'),
      ['order-a', 'payment_authorized', 'payment-a'],
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('INSERT INTO audit_logs'),
      expect.arrayContaining([
        'user-a',
        'stripe_payment_intent_amount_capturable_updated',
      ]),
    );
  });

  it('claims an expired five-day authorization and charges the flat no-send fee', async () => {
    const authorizedPayment = {
      ...startedPayment,
      stripe_payment_intent_id: 'pi_a',
      amount_cents: 999,
      status: 'authorized',
      decision_due_at: '2026-07-20T12:00:00.000Z',
      finalization_claimed_at: null,
    };
    findOrderRowForUpdate.mockResolvedValue({
      ...pendingOrder,
      status: 'payment_authorized',
    });
    transactionQuery
      .mockResolvedValueOnce({
        rows: [
          {
            payment_id: 'payment-a',
            order_id: 'order-a',
            user_id: 'user-a',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [authorizedPayment] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorizedPayment,
            status: 'succeeded',
            amount_captured_cents: 200,
            finalization_action: 'not_send',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    capturePayment.mockResolvedValue({
      paymentIntentId: 'pi_a',
      status: 'succeeded',
      amountCapturedCents: 200,
      providerMetadata: { amountReceived: 200 },
    });
    markPaymentState.mockResolvedValue({
      ...pendingOrder,
      status: 'closed_no_send',
    });

    await expect(service.finalizeDueAuthorizations(10)).resolves.toEqual({
      claimed: 1,
      finalized: 1,
      failed: 0,
    });

    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("finalization_action = 'not_send'"),
      [10],
    );
    expect(capturePayment).toHaveBeenCalledWith(
      'pi_a',
      200,
      'checkout:order-a:stripe:attempt:1:finalize:not_send',
    );
  });

  it('does not regress a succeeded payment when an older failure event arrives', async () => {
    const event = {
      id: 'evt_old_failure',
      type: 'payment_intent.payment_failed',
      livemode: false,
      api_version: '2026-06-24.dahlia',
      created: 1_800_000_000,
      data: {
        object: {
          id: 'pi_a',
          metadata: {
            souvenotePaymentId: 'payment-a',
            souvenoteOrderId: 'order-a',
          },
          status: 'requires_payment_method',
          amount: 1099,
          amount_capturable: 0,
          amount_received: 1099,
          currency: 'cad',
        },
      },
    } as unknown as Stripe.Event;
    getStripeProvider.mockReturnValue({
      constructWebhookEvent: jest.fn().mockReturnValue(event),
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ event_id: 'evt_old_failure' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...startedPayment,
            status: 'succeeded',
            stripe_payment_intent_id: 'pi_a',
            amount_captured_cents: 1099,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.handleStripeWebhook(Buffer.from('{}'), 'signature');

    expect(transactionQuery).toHaveBeenCalledTimes(4);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('status = ANY($7::VARCHAR[])'),
      expect.arrayContaining([['creating', 'checkout_started', 'failed']]),
    );
    expect(transactionQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders'),
      expect.anything(),
    );
  });

  it('captures only the frozen no-send fee and closes the order', async () => {
    const authorizedPayment = {
      ...startedPayment,
      stripe_payment_intent_id: 'pi_a',
      amount_cents: 1099,
      status: 'authorized',
    };
    findOrderRowForUpdate.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'payment_authorized',
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [authorizedPayment] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorizedPayment,
            status: 'succeeded',
            amount_captured_cents: 200,
            finalization_action: 'not_send',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    capturePayment.mockResolvedValue({
      paymentIntentId: 'pi_a',
      status: 'succeeded',
      amountCapturedCents: 200,
      providerMetadata: { amountReceived: 200 },
    });
    markPaymentState.mockResolvedValue({
      ...pendingOrder,
      status: 'closed_no_send',
    });

    await expect(
      service.finalizeAuthorization('user-a', {
        orderId: 'order-a',
        action: 'not_send',
      }),
    ).resolves.toMatchObject({
      order: { status: 'closed_no_send' },
      payment: { amountCapturedCents: 200 },
      idempotentReplay: false,
    });

    expect(capturePayment).toHaveBeenCalledWith(
      'pi_a',
      200,
      'checkout:order-a:stripe:attempt:1:finalize:not_send',
    );
    expect(markPaymentState).toHaveBeenCalledWith(
      'order-a',
      'closed_no_send',
      'payment-a',
      transaction,
    );
  });

  it('tracks a confirmed order after an authorized send is captured', async () => {
    const authorizedPayment = {
      ...startedPayment,
      stripe_payment_intent_id: 'pi_a',
      status: 'authorized',
    };
    findOrderRowForUpdate.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'payment_authorized',
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [authorizedPayment] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...authorizedPayment,
            status: 'succeeded',
            amount_captured_cents: 999,
            finalization_action: 'send',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    capturePayment.mockResolvedValue({
      paymentIntentId: 'pi_a',
      status: 'succeeded',
      amountCapturedCents: 999,
      providerMetadata: { amountReceived: 999 },
    });
    markPaymentState.mockResolvedValue({
      ...pendingOrder,
      status: 'paid',
    });

    await service.finalizeAuthorization('user-a', {
      orderId: 'order-a',
      action: 'send',
    });

    expect(enqueueOrderNotification).toHaveBeenCalledTimes(1);
    expect(orderConfirmed).toHaveBeenCalledWith('user-a', 'order-a', {
      providerMode: 'stripe',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'cad',
    });
  });

  it('starts a server-priced CAD credit-pack checkout', async () => {
    resolveCreditPackOffer.mockResolvedValue({
      id: 'pricing-credit-a',
      offer_code: 'credit_pack_creator_80',
      name: 'Creator Credits',
      offer_type: 'credit_pack',
      price_cents: 1000,
      currency: 'cad',
      card_count_min: 0,
      card_count_max: 0,
      credits_per_card: 80,
      shipping_included: false,
      metadata: { credit_amount: 80 },
      creditAmount: 80,
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [pendingCreditPackPurchase] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ attempt_number: 1 }] })
      .mockResolvedValueOnce({ rows: [creatingCreditPackPayment] })
      .mockResolvedValueOnce({
        rows: [
          {
            email: 'user@example.com',
            stripe_customer_id: 'cus_a',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [startedCreditPackPayment] })
      .mockResolvedValueOnce({ rows: [startedCreditPackPurchase] })
      .mockResolvedValueOnce({ rows: [] });
    createSession.mockResolvedValue({
      sessionId: 'cs_credit_a',
      paymentIntentId: 'pi_credit_a',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_credit_a',
      expiresAt: new Date('2026-07-23T12:30:00.000Z'),
      providerMetadata: { paymentStatus: 'unpaid' },
    });

    await expect(
      service.startCreditPackCheckout('user-a', {
        offerCode: 'credit_pack_creator_80',
        idempotencyKey: 'credit-request-a',
      }),
    ).resolves.toMatchObject({
      purchase: {
        id: 'credit-purchase-a',
        offerCode: 'credit_pack_creator_80',
        amountCents: 1000,
        currency: 'cad',
        creditAmount: 80,
      },
      checkoutSession: {
        id: 'cs_credit_a',
        creditPackPurchaseId: 'credit-purchase-a',
      },
    });

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: null,
        creditPackPurchaseId: 'credit-purchase-a',
        offerCode: 'credit_pack_creator_80',
        unitAmountCents: 1000,
        totalAmountCents: 1000,
        quantity: 1,
        currency: 'cad',
        captureMethod: 'automatic_async',
      }),
    );
  });

  it('grants exactly the purchased credits after mock payment succeeds', async () => {
    const mockProvider: CheckoutProvider = {
      mode: 'mock',
      createSession,
    };
    const mockStartedPayment = {
      ...startedCreditPackPayment,
      provider_mode: 'mock',
      idempotency_key: 'credit-checkout:credit-purchase-a:mock:attempt:1',
    };
    const paidPayment = {
      ...mockStartedPayment,
      status: 'succeeded_mock',
      amount_captured_cents: 1000,
      metadata: { paidMockAt: '2026-07-23T12:05:00.000Z' },
    };
    const paidPurchase = {
      ...startedCreditPackPurchase,
      status: 'paid',
    };
    getActiveProvider.mockReturnValue(mockProvider);
    transactionQuery
      .mockResolvedValueOnce({ rows: [startedCreditPackPurchase] })
      .mockResolvedValueOnce({ rows: [mockStartedPayment] })
      .mockResolvedValueOnce({ rows: [paidPayment] })
      .mockResolvedValueOnce({ rows: [paidPurchase] })
      .mockResolvedValueOnce({ rows: [] });
    grantOnceInTransaction.mockResolvedValue({
      granted: true,
      ledgerEntry: { id: 'ledger-credit-a' },
      balance: { userId: 'user-a', balance: 80 },
    });

    await expect(
      service.simulateCreditPackCheckoutSuccess('user-a', {
        purchaseId: 'credit-purchase-a',
        checkoutSessionId: 'cs_credit_a',
      }),
    ).resolves.toMatchObject({
      purchase: { status: 'paid', creditAmount: 80 },
      balance: { userId: 'user-a', balance: 80 },
    });

    expect(grantOnceInTransaction).toHaveBeenCalledWith(
      transaction,
      'user-a',
      80,
      'credit_pack_creator_80',
      'credit-pack-purchase:credit-purchase-a',
      'credit_pack_purchase',
    );
  });

  it('grants the frozen credit amount after a signed Stripe payment succeeds', async () => {
    const event = {
      id: 'evt_credit_paid',
      type: 'payment_intent.succeeded',
      livemode: false,
      api_version: '2026-06-24.dahlia',
      created: 1_800_000_000,
      data: {
        object: {
          id: 'pi_credit_a',
          metadata: {
            souvenotePaymentId: 'credit-payment-a',
            souvenoteCreditPackPurchaseId: 'credit-purchase-a',
          },
          status: 'succeeded',
          amount: 1000,
          amount_capturable: 0,
          amount_received: 1000,
          currency: 'cad',
        },
      },
    } as unknown as Stripe.Event;
    getStripeProvider.mockReturnValue({
      constructWebhookEvent: jest.fn().mockReturnValue(event),
    });
    grantOnceInTransaction.mockResolvedValue({
      granted: true,
      balance: { userId: 'user-a', balance: 80 },
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ event_id: 'evt_credit_paid' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...startedCreditPackPayment,
            stripe_payment_intent_id: 'pi_credit_a',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'credit-payment-a' }] })
      .mockResolvedValueOnce({ rows: [startedCreditPackPurchase] })
      .mockResolvedValueOnce({
        rows: [{ ...startedCreditPackPurchase, status: 'paid' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'signature'),
    ).resolves.toMatchObject({ received: true, duplicate: false });

    expect(grantOnceInTransaction).toHaveBeenCalledWith(
      transaction,
      'user-a',
      80,
      'credit_pack_creator_80',
      'credit-pack-purchase:credit-purchase-a',
      'credit_pack_purchase',
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('UPDATE credit_pack_purchases'),
      ['credit-purchase-a', 'paid', 'credit-payment-a'],
    );
  });
});
