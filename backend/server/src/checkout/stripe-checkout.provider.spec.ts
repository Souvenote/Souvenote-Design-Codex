import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { CheckoutSessionRequest } from './checkout.provider';
import { StripeCheckoutProvider } from './stripe-checkout.provider';

const request: CheckoutSessionRequest = {
  localPaymentId: 'payment-a',
  orderId: 'order-a',
  creditPackPurchaseId: null,
  cardPackPurchaseId: null,
  userId: 'user-a',
  customerId: null,
  customerEmail: 'user@example.com',
  offerCode: 'try_risk_free_one_card',
  productName: 'Try Risk-Free',
  unitAmountCents: 999,
  totalAmountCents: 999,
  quantity: 1,
  currency: 'usd',
  captureMethod: 'manual',
  successUrl:
    'https://app.example.com/delivery?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://app.example.com/delivery?checkout=cancel',
  idempotencyKey: 'checkout:order-a:stripe:attempt:1',
};

describe('StripeCheckoutProvider', () => {
  type CreateSession = Stripe['checkout']['sessions']['create'];
  const asSessionResponse = (session: Record<string, unknown>) =>
    session as unknown as Awaited<ReturnType<CreateSession>>;
  const createSession = jest.fn<
    ReturnType<CreateSession>,
    Parameters<CreateSession>
  >();
  const capture = jest.fn();
  const cancel = jest.fn();
  const constructEvent = jest.fn();
  const stripe = {
    checkout: { sessions: { create: createSession } },
    paymentIntents: { capture, cancel },
    webhooks: { constructEvent },
  } as unknown as Stripe;
  const config: Record<string, string | undefined> = {};
  const getConfig = jest.fn((key: string) => config[key]);
  const provider = new StripeCheckoutProvider(stripe, {
    get: getConfig,
  } as unknown as ConfigService);

  beforeEach(() => {
    createSession.mockReset();
    capture.mockReset();
    cancel.mockReset();
    constructEvent.mockReset();
    getConfig.mockClear();
    Object.keys(config).forEach((key) => delete config[key]);
    config.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('creates a server-priced manual-capture Checkout Session idempotently', async () => {
    createSession.mockResolvedValue(
      asSessionResponse({
        id: 'cs_test_a',
        url: 'https://checkout.stripe.com/c/pay/cs_test_a',
        payment_intent: null,
        expires_at: 1_800_000_000,
        status: 'open',
        payment_status: 'unpaid',
        amount_subtotal: 999,
        amount_total: 999,
        currency: 'usd',
      }),
    );

    await expect(provider.createSession(request)).resolves.toMatchObject({
      sessionId: 'cs_test_a',
      paymentIntentId: null,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_a',
    });

    expect(createSession).toHaveBeenCalledTimes(1);
    const call = createSession.mock.calls[0];
    expect(call?.[0]).toMatchObject({
      mode: 'payment',
      client_reference_id: 'order-a',
      customer_creation: 'always',
      customer_email: 'user@example.com',
      automatic_tax: { enabled: true },
      payment_method_types: ['card'],
      payment_intent_data: {
        capture_method: 'manual',
        metadata: {
          souvenoteOrderId: 'order-a',
          souvenotePaymentId: 'payment-a',
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'usd', unit_amount: 999 },
        },
      ],
    });
    expect(call?.[1]).toEqual({ idempotencyKey: request.idempotencyKey });
  });

  it('rejects a provider subtotal that differs from the frozen order total', async () => {
    createSession.mockResolvedValue(
      asSessionResponse({
        id: 'cs_test_a',
        url: 'https://checkout.stripe.com/c/pay/cs_test_a',
        payment_intent: null,
        expires_at: 1_800_000_000,
        status: 'open',
        payment_status: 'unpaid',
        amount_subtotal: 1,
        amount_total: 1,
        currency: 'usd',
      }),
    );

    await expect(provider.createSession(request)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('reconciles a card-pack session with dedicated Stripe metadata', async () => {
    createSession.mockResolvedValue(
      asSessionResponse({
        id: 'cs_card_a',
        url: 'https://checkout.stripe.com/c/pay/cs_card_a',
        payment_intent: null,
        expires_at: 1_800_000_000,
        status: 'open',
        payment_status: 'unpaid',
        amount_subtotal: 4495,
        amount_total: 4495,
        currency: 'cad',
      }),
    );
    await provider.createSession({
      ...request,
      orderId: null,
      cardPackPurchaseId: 'card-purchase-a',
      offerCode: 'big_sender_2_10',
      productName: 'Big Sender 2-10 Cards',
      unitAmountCents: 899,
      totalAmountCents: 4495,
      quantity: 5,
      currency: 'cad',
      captureMethod: 'automatic_async',
    });

    expect(createSession.mock.calls[0]?.[0]).toMatchObject({
      client_reference_id: 'card-purchase-a',
      metadata: {
        souvenotePaymentId: 'payment-a',
        souvenoteCardPackPurchaseId: 'card-purchase-a',
      },
      line_items: [
        {
          quantity: 5,
          price_data: { currency: 'cad', unit_amount: 899 },
        },
      ],
    });
  });

  it('verifies webhook signatures against the raw request body', () => {
    const event = { id: 'evt_a' };
    constructEvent.mockReturnValue(event);
    const payload = Buffer.from('{"id":"evt_a"}');

    expect(provider.constructWebhookEvent(payload, 'signature')).toBe(event);
    expect(constructEvent).toHaveBeenCalledWith(
      payload,
      'signature',
      'whsec_test',
    );
  });

  it('fails closed on an invalid Stripe signature', () => {
    constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    expect(() =>
      provider.constructWebhookEvent(Buffer.from('{}'), 'bad'),
    ).toThrow(BadRequestException);
  });

  it('accepts either of two webhook secrets during a bounded rotation', () => {
    delete config.STRIPE_WEBHOOK_SECRET;
    config.STRIPE_WEBHOOK_SECRETS = 'whsec_new, whsec_previous';
    const event = { id: 'evt_rotated' };
    constructEvent
      .mockImplementationOnce(() => {
        throw new Error('not signed with the new secret');
      })
      .mockReturnValueOnce(event);
    const payload = Buffer.from('{"id":"evt_rotated"}');

    expect(provider.constructWebhookEvent(payload, 'signature')).toBe(event);
    expect(constructEvent).toHaveBeenNthCalledWith(
      1,
      payload,
      'signature',
      'whsec_new',
    );
    expect(constructEvent).toHaveBeenNthCalledWith(
      2,
      payload,
      'signature',
      'whsec_previous',
    );
  });

  it.each([
    ['whsec_a,,whsec_b', 'empty entry'],
    ['whsec_a,whsec_b,whsec_c', 'At most two'],
    ['not-a-stripe-secret', 'must start with whsec_'],
  ])('rejects unsafe webhook overlap configuration %s', (value, message) => {
    delete config.STRIPE_WEBHOOK_SECRET;
    config.STRIPE_WEBHOOK_SECRETS = value;

    expect(() =>
      provider.constructWebhookEvent(Buffer.from('{}'), 'signature'),
    ).toThrow(message);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it('captures only the requested authorized amount with an idempotency key', async () => {
    capture.mockResolvedValue({
      id: 'pi_a',
      status: 'succeeded',
      amount: 999,
      amount_capturable: 0,
      amount_received: 200,
      currency: 'usd',
    });

    await expect(
      provider.capturePayment('pi_a', 200, 'capture-key'),
    ).resolves.toMatchObject({
      status: 'succeeded',
      amountCapturedCents: 200,
    });
    expect(capture).toHaveBeenCalledWith(
      'pi_a',
      { amount_to_capture: 200 },
      { idempotencyKey: 'capture-key' },
    );
  });
});
