import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
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
import type {
  FinalizeAuthorizationDto,
  MockCreditPackSuccessDto,
  MockCheckoutSuccessDto,
  StartCreditPackCheckoutDto,
  StartCheckoutDto,
} from './checkout.controller';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import type {
  CheckoutCaptureMethod,
  CheckoutProvider,
  CheckoutProviderMode,
  CheckoutSessionResult,
} from './checkout.provider';

type PaymentRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  credit_pack_purchase_id: string | null;
  stripe_payment_intent_id: string | null;
  offer_code: string;
  amount_cents: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown> | null;
  provider_mode: CheckoutProviderMode;
  checkout_session_id: string | null;
  capture_method: CheckoutCaptureMethod;
  attempt_number: number;
  idempotency_key: string;
  amount_captured_cents: number;
  finalization_action: 'send' | 'not_send' | null;
  decision_due_at: Date | string | null;
  finalization_claimed_at: Date | string | null;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CreditPackPurchaseRow = {
  id: string;
  user_id: string;
  pricing_catalog_id: string;
  offer_code: string;
  status:
    | 'pending'
    | 'checkout_started'
    | 'paid'
    | 'payment_failed'
    | 'payment_canceled'
    | 'checkout_expired';
  amount_cents: number;
  currency: string;
  credit_amount: number;
  pricing_snapshot: Record<string, unknown>;
  idempotency_key: string;
  checkout_session_id: string | null;
  payment_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CheckoutCustomerRow = {
  email: string;
  stripe_customer_id: string | null;
};

type PreparedCheckout = {
  order: OrderRow;
  payment: PaymentRow;
  customer: CheckoutCustomerRow | null;
  idempotentReplay: boolean;
};

type PreparedCreditPackCheckout = {
  purchase: CreditPackPurchaseRow;
  payment: PaymentRow;
  customer: CheckoutCustomerRow | null;
  idempotentReplay: boolean;
};

const HANDLED_STRIPE_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.amount_capturable_updated',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
]);

@Injectable()
export class CheckoutService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ordersService: OrdersService,
    private readonly providerRegistry: CheckoutProviderRegistry,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly creditsService: CreditsService,
    private readonly pricingService: PricingService,
    @Optional()
    private readonly analyticsService?: AnalyticsService,
  ) {}

  async startCheckout(userId: string, dto: StartCheckoutDto) {
    const provider = this.providerRegistry.getActiveProvider();
    const prepared = await this.prepareCheckout(userId, dto.orderId, provider);

    if (
      prepared.idempotentReplay &&
      prepared.payment.status === 'checkout_started'
    ) {
      return this.buildCheckoutResponse(prepared.order, prepared.payment, true);
    }

    if (!prepared.customer) {
      throw new InternalServerErrorException(
        'Checkout customer was not found.',
      );
    }

    let providerSession: CheckoutSessionResult;
    try {
      const pricing = this.resolvePricing(prepared.order);
      providerSession = await provider.createSession({
        localPaymentId: prepared.payment.id,
        orderId: prepared.order.id,
        creditPackPurchaseId: null,
        userId: prepared.order.user_id,
        customerId: prepared.customer.stripe_customer_id,
        customerEmail: prepared.customer.email,
        offerCode: pricing.offerCode,
        productName: pricing.productName,
        unitAmountCents: pricing.unitAmountCents,
        totalAmountCents: prepared.order.amount_cents,
        quantity: prepared.order.quantity,
        currency: prepared.order.currency,
        captureMethod: prepared.payment.capture_method,
        successUrl: this.checkoutRedirectUrl('success', provider.mode),
        cancelUrl: this.checkoutRedirectUrl('cancel', provider.mode),
        idempotencyKey: prepared.payment.idempotency_key,
      });
    } catch (error) {
      await this.markCheckoutStartFailed(
        prepared.order,
        prepared.payment,
        error,
      );
      if (error instanceof InternalServerErrorException) throw error;
      throw new BadGatewayException(
        'The checkout provider could not create a session. Try again.',
      );
    }

    const finalized = await this.databaseService.withTransaction(
      async (transaction) => {
        const paymentResult = await transaction.query<PaymentRow>(
          `
            UPDATE payments
            SET
              stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
              checkout_session_id = $3,
              status = 'checkout_started',
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
              expires_at = $5,
              updated_at = NOW()
            WHERE id = $1
              AND status IN ('creating', 'checkout_started')
            RETURNING ${this.paymentColumns};
          `,
          [
            prepared.payment.id,
            providerSession.paymentIntentId,
            providerSession.sessionId,
            JSON.stringify({
              checkoutUrl: providerSession.checkoutUrl,
              ...providerSession.providerMetadata,
            }),
            providerSession.expiresAt,
          ],
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
          throw new ConflictException(
            'Checkout changed while the provider session was being created.',
          );
        }

        const order = await this.ordersService.markCheckoutStarted(
          prepared.order.id,
          providerSession.sessionId,
          payment.id,
          transaction,
        );
        await this.writeAudit(
          transaction,
          order.user_id,
          'checkout_started',
          'order',
          order.id,
          {
            paymentId: payment.id,
            providerMode: payment.provider_mode,
            attemptNumber: payment.attempt_number,
          },
        );
        return { order, payment };
      },
    );
    this.analyticsService?.checkoutStarted(
      finalized.order.user_id,
      finalized.order.id,
      {
        providerMode: finalized.payment.provider_mode,
        offerType: finalized.order.offer_code ?? finalized.payment.offer_code,
        quantity: finalized.order.quantity,
        currency: finalized.order.currency,
      },
    );

    return this.buildCheckoutResponse(
      finalized.order,
      finalized.payment,
      prepared.idempotentReplay,
    );
  }

  async startCreditPackCheckout(
    userId: string,
    dto: StartCreditPackCheckoutDto,
  ) {
    const provider = this.providerRegistry.getActiveProvider();
    const offer = await this.pricingService.resolveCreditPackOffer(
      dto.offerCode,
    );
    const prepared = await this.prepareCreditPackCheckout(
      userId,
      dto,
      offer,
      provider,
    );

    if (
      prepared.idempotentReplay &&
      ['checkout_started', 'succeeded', 'succeeded_mock'].includes(
        prepared.payment.status,
      )
    ) {
      return this.buildCreditPackCheckoutResponse(
        prepared.purchase,
        prepared.payment,
        true,
      );
    }
    if (!prepared.customer) {
      throw new InternalServerErrorException(
        'Credit-pack checkout customer was not found.',
      );
    }

    const pricing = this.resolveCreditPackPricing(prepared.purchase);
    let providerSession: CheckoutSessionResult;
    try {
      providerSession = await provider.createSession({
        localPaymentId: prepared.payment.id,
        orderId: null,
        creditPackPurchaseId: prepared.purchase.id,
        userId: prepared.purchase.user_id,
        customerId: prepared.customer.stripe_customer_id,
        customerEmail: prepared.customer.email,
        offerCode: prepared.purchase.offer_code,
        productName: pricing.productName,
        unitAmountCents: prepared.purchase.amount_cents,
        totalAmountCents: prepared.purchase.amount_cents,
        quantity: 1,
        currency: prepared.purchase.currency,
        captureMethod: 'automatic_async',
        successUrl: this.creditCheckoutRedirectUrl('success', provider.mode),
        cancelUrl: this.creditCheckoutRedirectUrl('cancel', provider.mode),
        idempotencyKey: prepared.payment.idempotency_key,
      });
    } catch (error) {
      await this.markCreditPackCheckoutStartFailed(
        prepared.purchase,
        prepared.payment,
        error,
      );
      if (error instanceof InternalServerErrorException) throw error;
      throw new BadGatewayException(
        'The checkout provider could not create a credit-pack session. Try again.',
      );
    }

    const finalized = await this.databaseService.withTransaction(
      async (transaction) => {
        const paymentResult = await transaction.query<PaymentRow>(
          `
            UPDATE payments
            SET
              stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
              checkout_session_id = $3,
              status = 'checkout_started',
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
              expires_at = $5,
              updated_at = NOW()
            WHERE id = $1
              AND status IN ('creating', 'checkout_started')
            RETURNING ${this.paymentColumns};
          `,
          [
            prepared.payment.id,
            providerSession.paymentIntentId,
            providerSession.sessionId,
            JSON.stringify({
              checkoutUrl: providerSession.checkoutUrl,
              ...providerSession.providerMetadata,
            }),
            providerSession.expiresAt,
          ],
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
          throw new ConflictException(
            'Credit-pack checkout changed while the provider session was being created.',
          );
        }

        const purchaseResult = await transaction.query<CreditPackPurchaseRow>(
          `
            UPDATE credit_pack_purchases
            SET
              status = 'checkout_started',
              checkout_session_id = $2,
              payment_id = $3,
              updated_at = NOW()
            WHERE id = $1
              AND status IN (
                'pending',
                'checkout_started',
                'payment_failed',
                'payment_canceled',
                'checkout_expired'
              )
            RETURNING ${this.creditPackPurchaseColumns};
          `,
          [prepared.purchase.id, providerSession.sessionId, payment.id],
        );
        const purchase = purchaseResult.rows[0];
        if (!purchase) {
          throw new ConflictException(
            'Credit-pack purchase changed while checkout was starting.',
          );
        }
        await this.writeAudit(
          transaction,
          purchase.user_id,
          'credit_pack_checkout_started',
          'credit_pack_purchase',
          purchase.id,
          {
            paymentId: payment.id,
            providerMode: payment.provider_mode,
            offerCode: purchase.offer_code,
          },
        );
        return { purchase, payment };
      },
    );

    return this.buildCreditPackCheckoutResponse(
      finalized.purchase,
      finalized.payment,
      prepared.idempotentReplay,
    );
  }

  async simulateCreditPackCheckoutSuccess(
    userId: string,
    dto: MockCreditPackSuccessDto,
  ) {
    if (this.providerRegistry.getActiveProvider().mode !== 'mock') {
      throw new ForbiddenException(
        'The mock credit-pack completion endpoint is disabled outside mock mode.',
      );
    }

    return this.databaseService.withTransaction(async (transaction) => {
      const purchase = await this.findCreditPackPurchaseForUpdate(
        transaction,
        dto.purchaseId,
        userId,
      );
      const payment = await this.findLatestCreditPackPayment(
        transaction,
        purchase.id,
      );
      if (!payment || payment.provider_mode !== 'mock') {
        throw new BadRequestException(
          'Mock credit-pack checkout session was not found.',
        );
      }

      if (purchase.status === 'paid') {
        return {
          ...this.buildCreditPackCheckoutResponse(purchase, payment, true),
          balance: await this.creditsService.findBalance(userId),
        };
      }
      if (
        purchase.status !== 'checkout_started' ||
        payment.status !== 'checkout_started'
      ) {
        throw new ConflictException(
          'Credit-pack checkout is not ready to complete.',
        );
      }
      const sessionId = dto.checkoutSessionId ?? purchase.checkout_session_id;
      if (
        !sessionId ||
        purchase.checkout_session_id !== sessionId ||
        payment.checkout_session_id !== sessionId
      ) {
        throw new BadRequestException(
          'Mock credit-pack checkout session does not match the purchase.',
        );
      }

      const paidAt = new Date().toISOString();
      const paymentResult = await transaction.query<PaymentRow>(
        `
          UPDATE payments
          SET
            status = 'succeeded_mock',
            amount_captured_cents = amount_cents,
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
          WHERE id = $1
            AND status = 'checkout_started'
          RETURNING ${this.paymentColumns};
        `,
        [payment.id, JSON.stringify({ paidMockAt: paidAt })],
      );
      const paidPayment = paymentResult.rows[0];
      if (!paidPayment) {
        throw new ConflictException(
          'Credit-pack payment changed while it was being completed.',
        );
      }
      const purchaseResult = await transaction.query<CreditPackPurchaseRow>(
        `
          UPDATE credit_pack_purchases
          SET status = 'paid', payment_id = $2, updated_at = NOW()
          WHERE id = $1
            AND status = 'checkout_started'
          RETURNING ${this.creditPackPurchaseColumns};
        `,
        [purchase.id, paidPayment.id],
      );
      const paidPurchase = purchaseResult.rows[0];
      if (!paidPurchase) {
        throw new ConflictException(
          'Credit-pack purchase changed while it was being completed.',
        );
      }
      const creditResult = await this.creditsService.grantOnceInTransaction(
        transaction,
        paidPurchase.user_id,
        paidPurchase.credit_amount,
        paidPurchase.offer_code,
        `credit-pack-purchase:${paidPurchase.id}`,
        'credit_pack_purchase',
      );
      await this.writeAudit(
        transaction,
        paidPurchase.user_id,
        'credit_pack_purchase_paid_mock',
        'credit_pack_purchase',
        paidPurchase.id,
        {
          paymentId: paidPayment.id,
          creditAmount: paidPurchase.credit_amount,
        },
      );
      return {
        ...this.buildCreditPackCheckoutResponse(
          paidPurchase,
          paidPayment,
          false,
        ),
        balance: creditResult.balance,
      };
    });
  }

  async simulateCheckoutSuccess(userId: string, dto: MockCheckoutSuccessDto) {
    if (this.providerRegistry.getActiveProvider().mode !== 'mock') {
      throw new ForbiddenException(
        'The mock checkout completion endpoint is disabled outside mock mode.',
      );
    }

    const result = await this.databaseService.withTransaction(
      async (transaction) => {
        const order = await this.ordersService.findOrderRowForUpdate(
          transaction,
          dto.orderId,
          userId,
        );
        this.ordersService.assertOrderStatus(
          order,
          ['checkout_started'],
          'complete mock checkout',
        );
        const sessionId = dto.checkoutSessionId ?? order.checkout_session_id;
        if (!sessionId || order.checkout_session_id !== sessionId) {
          throw new BadRequestException(
            'checkoutSessionId does not match this order.',
          );
        }

        const paymentResult = await transaction.query<PaymentRow>(
          `
            UPDATE payments
            SET
              status = 'succeeded_mock',
              amount_captured_cents = amount_cents,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = NOW()
            WHERE order_id = $1
              AND checkout_session_id = $2
              AND provider_mode = 'mock'
              AND status = 'checkout_started'
            RETURNING ${this.paymentColumns};
          `,
          [
            order.id,
            sessionId,
            JSON.stringify({ paidMockAt: new Date().toISOString() }),
          ],
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
          throw new BadRequestException('Mock checkout session was not found.');
        }
        const updatedOrder = await this.ordersService.markPaidMock(
          order.id,
          payment.id,
          transaction,
        );
        await this.writeAudit(
          transaction,
          userId,
          'checkout_paid_mock',
          'order',
          order.id,
          { paymentId: payment.id },
        );
        await this.notificationsService.enqueueOrderNotification(transaction, {
          eventType: 'order_confirmation',
          userId: updatedOrder.user_id,
          orderId: updatedOrder.id,
          orderStatus: updatedOrder.status,
          quantity: updatedOrder.quantity,
          amountCents: updatedOrder.amount_cents,
          currency: updatedOrder.currency,
        });
        return { order: updatedOrder, payment };
      },
    );
    this.analyticsService?.orderConfirmed(
      result.order.user_id,
      result.order.id,
      {
        providerMode: result.payment.provider_mode,
        offerType: result.order.offer_code ?? result.payment.offer_code,
        quantity: result.order.quantity,
        currency: result.order.currency,
      },
    );

    return this.buildCheckoutResponse(result.order, result.payment, false);
  }

  async finalizeAuthorization(userId: string, dto: FinalizeAuthorizationDto) {
    const provider = this.providerRegistry.getActiveProvider();
    if (
      provider.mode !== 'stripe' ||
      !provider.capturePayment ||
      !provider.cancelPayment
    ) {
      throw new ForbiddenException(
        'Payment authorization finalization requires Stripe checkout mode.',
      );
    }

    const prepared = await this.databaseService.withTransaction(
      async (transaction) => {
        const order = await this.ordersService.findOrderRowForUpdate(
          transaction,
          dto.orderId,
          userId,
        );
        if (
          (dto.action === 'send' && order.status === 'paid') ||
          (dto.action === 'not_send' && order.status === 'closed_no_send')
        ) {
          const payment = await this.findLatestPayment(
            transaction,
            order.id,
            true,
          );
          return { order, payment, idempotentReplay: true };
        }
        this.ordersService.assertOrderStatus(
          order,
          ['payment_authorized'],
          'finalize payment authorization',
        );
        const payment = await this.findLatestPayment(
          transaction,
          order.id,
          true,
        );
        if (
          !payment ||
          payment.provider_mode !== 'stripe' ||
          payment.capture_method !== 'manual' ||
          payment.status !== 'authorized' ||
          !payment.stripe_payment_intent_id
        ) {
          throw new ConflictException(
            'The order does not have an actionable Stripe authorization.',
          );
        }
        if (
          payment.finalization_action &&
          payment.finalization_action !== dto.action
        ) {
          throw new ConflictException(
            'This payment authorization is already being finalized differently.',
          );
        }
        await transaction.query(
          `
            UPDATE payments
            SET
              finalization_action = $2,
              finalization_claimed_at = NOW(),
              updated_at = NOW()
            WHERE id = $1;
          `,
          [payment.id, dto.action],
        );
        return {
          order,
          payment: { ...payment, finalization_action: dto.action },
          idempotentReplay: false,
        };
      },
    );

    if (!prepared.payment) {
      throw new ConflictException('Stripe payment record was not found.');
    }
    if (prepared.idempotentReplay) {
      return {
        order: this.ordersService.toOrderResponse(prepared.order),
        payment: this.toPaymentResponse(prepared.payment),
        idempotentReplay: true,
      };
    }

    const paymentIntentId = prepared.payment.stripe_payment_intent_id;
    if (!paymentIntentId) {
      throw new ConflictException('Stripe payment intent was not found.');
    }
    const noSendFee = this.noSendFee(prepared.order);
    const amountToCapture =
      dto.action === 'send' ? prepared.payment.amount_cents : noSendFee;
    const idempotencyKey = `${prepared.payment.idempotency_key}:finalize:${dto.action}`;
    const providerResult =
      amountToCapture > 0
        ? await provider.capturePayment(
            paymentIntentId,
            amountToCapture,
            idempotencyKey,
          )
        : await provider.cancelPayment(paymentIntentId, idempotencyKey);
    if (
      (amountToCapture > 0 &&
        (providerResult.status !== 'succeeded' ||
          providerResult.amountCapturedCents !== amountToCapture)) ||
      (amountToCapture === 0 && providerResult.status !== 'canceled')
    ) {
      throw new BadGatewayException(
        'Stripe did not confirm the requested authorization finalization.',
      );
    }
    const terminalOrderStatus =
      dto.action === 'send' ? ('paid' as const) : ('closed_no_send' as const);

    const finalized = await this.databaseService.withTransaction(
      async (transaction) => {
        const paymentResult = await transaction.query<PaymentRow>(
          `
            UPDATE payments
            SET
              status = $2,
              amount_captured_cents = $3,
              metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
              updated_at = NOW()
            WHERE id = $1
              AND status IN ('authorized', 'succeeded', 'canceled')
            RETURNING ${this.paymentColumns};
          `,
          [
            prepared.payment.id,
            amountToCapture > 0 ? 'succeeded' : 'canceled',
            providerResult.amountCapturedCents,
            JSON.stringify(providerResult.providerMetadata),
          ],
        );
        const payment = paymentResult.rows[0];
        if (!payment) {
          throw new ConflictException(
            'Payment authorization changed while it was being finalized.',
          );
        }
        const order = await this.ordersService.markPaymentState(
          prepared.order.id,
          terminalOrderStatus,
          payment.id,
          transaction,
        );
        await this.writeAudit(
          transaction,
          userId,
          `checkout_authorization_${dto.action}`,
          'order',
          order.id,
          {
            paymentId: payment.id,
            amountCapturedCents: payment.amount_captured_cents,
          },
        );
        if (terminalOrderStatus === 'paid') {
          await this.notificationsService.enqueueOrderNotification(
            transaction,
            {
              eventType: 'order_confirmation',
              userId: order.user_id,
              orderId: order.id,
              orderStatus: order.status,
              quantity: order.quantity,
              amountCents: order.amount_cents,
              currency: order.currency,
            },
          );
        }
        return { order, payment };
      },
    );
    if (terminalOrderStatus === 'paid') {
      this.analyticsService?.orderConfirmed(
        finalized.order.user_id,
        finalized.order.id,
        {
          providerMode: finalized.payment.provider_mode,
          offerType: finalized.order.offer_code ?? finalized.payment.offer_code,
          quantity: finalized.order.quantity,
          currency: finalized.order.currency,
        },
      );
    }

    return {
      order: this.ordersService.toOrderResponse(finalized.order),
      payment: this.toPaymentResponse(finalized.payment),
      idempotentReplay: false,
    };
  }

  async finalizeDueAuthorizations(batchSize = 10) {
    const provider = this.providerRegistry.getActiveProvider();
    if (
      provider.mode !== 'stripe' ||
      !provider.capturePayment ||
      !provider.cancelPayment
    ) {
      return { claimed: 0, finalized: 0, failed: 0 };
    }
    const boundedBatchSize = Math.min(50, Math.max(1, Math.floor(batchSize)));
    const claimed = await this.databaseService.withTransaction(
      async (transaction) => {
        const result = await transaction.query<{
          payment_id: string;
          order_id: string;
          user_id: string;
        }>(
          `
            WITH due AS (
              SELECT payment.id
              FROM payments payment
              INNER JOIN orders order_record
                ON order_record.id = payment.order_id
              WHERE payment.capture_method = 'manual'
                AND payment.status = 'authorized'
                AND payment.decision_due_at IS NOT NULL
                AND payment.decision_due_at <= NOW()
                AND order_record.status = 'payment_authorized'
                AND (
                  payment.finalization_action IS NULL
                  OR (
                    payment.finalization_action = 'not_send'
                    AND (
                      payment.finalization_claimed_at IS NULL
                      OR payment.finalization_claimed_at
                        <= NOW() - INTERVAL '5 minutes'
                    )
                  )
                )
              ORDER BY payment.decision_due_at ASC
              LIMIT $1
              FOR UPDATE OF payment SKIP LOCKED
            )
            UPDATE payments payment
            SET
              finalization_action = 'not_send',
              finalization_claimed_at = NOW(),
              updated_at = NOW()
            FROM due
            WHERE payment.id = due.id
            RETURNING
              payment.id AS payment_id,
              payment.order_id,
              payment.user_id;
          `,
          [boundedBatchSize],
        );
        return result.rows;
      },
    );

    let finalized = 0;
    let failed = 0;
    for (const authorization of claimed) {
      try {
        await this.finalizeAuthorization(authorization.user_id, {
          orderId: authorization.order_id,
          action: 'not_send',
        });
        finalized += 1;
      } catch {
        failed += 1;
      }
    }
    return { claimed: claimed.length, finalized, failed };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    if (!payload.length || !signature.trim()) {
      throw new BadRequestException(
        'Stripe webhook payload and signature are required.',
      );
    }
    const provider = this.providerRegistry.getStripeProvider();
    if (!provider.constructWebhookEvent) {
      throw new InternalServerErrorException(
        'Stripe webhook verification is unavailable.',
      );
    }
    const event = provider.constructWebhookEvent(payload, signature);
    const expectedLivemode = this.readBoolean('STRIPE_EXPECT_LIVEMODE', false);
    if (event.livemode !== expectedLivemode) {
      throw new BadRequestException(
        'Stripe webhook livemode does not match this environment.',
      );
    }

    const outcome = await this.databaseService.withTransaction(
      async (transaction) => {
        const object = event.data.object as { id?: string };
        const inserted = await transaction.query<{ event_id: string }>(
          `
          INSERT INTO stripe_webhook_events (
            event_id,
            event_type,
            object_id,
            livemode,
            status,
            event_metadata
          )
          VALUES ($1, $2, $3, $4, 'processing', $5::jsonb)
          ON CONFLICT (event_id) DO NOTHING
          RETURNING event_id;
        `,
          [
            event.id,
            event.type,
            typeof object.id === 'string' ? object.id : null,
            event.livemode,
            JSON.stringify({
              apiVersion: event.api_version,
              eventCreated: event.created,
            }),
          ],
        );
        if (!inserted.rows[0]) {
          await transaction.query(
            `
            UPDATE stripe_webhook_events
            SET attempt_count = attempt_count + 1, updated_at = NOW()
            WHERE event_id = $1;
          `,
            [event.id],
          );
          return { received: true, duplicate: true, eventId: event.id };
        }

        if (!HANDLED_STRIPE_EVENTS.has(event.type)) {
          await this.completeWebhookEvent(transaction, event.id, 'ignored');
          return {
            received: true,
            duplicate: false,
            ignored: true,
            eventId: event.id,
          };
        }

        if (event.type.startsWith('checkout.session.')) {
          await this.processCheckoutSessionEvent(
            transaction,
            event,
            event.data.object as Stripe.Checkout.Session,
          );
        } else {
          await this.processPaymentIntentEvent(
            transaction,
            event,
            event.data.object as Stripe.PaymentIntent,
          );
        }
        await this.completeWebhookEvent(transaction, event.id, 'processed');
        return {
          received: true,
          duplicate: false,
          ignored: false,
          eventId: event.id,
        };
      },
    );
    if (!outcome.duplicate && !outcome.ignored) {
      await this.trackConfirmedStripeOrder(event);
    }
    return outcome;
  }

  private async trackConfirmedStripeOrder(event: Stripe.Event) {
    if (
      ![
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'payment_intent.succeeded',
      ].includes(event.type)
    ) {
      return;
    }
    const object = event.data.object as {
      metadata?: Stripe.Metadata | null;
    };
    const paymentId = object.metadata?.souvenotePaymentId;
    const orderId = object.metadata?.souvenoteOrderId;
    if (!paymentId || !orderId) return;
    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      offer_code: string | null;
      quantity: number;
      currency: string;
      provider_mode: CheckoutProviderMode;
    }>(
      `
        SELECT
          order_record.id,
          order_record.user_id,
          order_record.offer_code,
          order_record.quantity,
          order_record.currency,
          payment.provider_mode
        FROM payments payment
        INNER JOIN orders order_record ON order_record.id = payment.order_id
        WHERE payment.id = $1
          AND order_record.status = 'paid'
        LIMIT 1;
      `,
      [paymentId],
    );
    const order = result.rows[0];
    if (!order) return;
    this.analyticsService?.orderConfirmed(order.user_id, order.id, {
      providerMode: order.provider_mode,
      offerType: order.offer_code ?? 'unknown',
      quantity: order.quantity,
      currency: order.currency,
    });
  }

  private async prepareCreditPackCheckout(
    userId: string,
    dto: StartCreditPackCheckoutDto,
    offer: Awaited<ReturnType<PricingService['resolveCreditPackOffer']>>,
    provider: CheckoutProvider,
  ): Promise<PreparedCreditPackCheckout> {
    return this.databaseService.withTransaction(async (transaction) => {
      const existingResult = await transaction.query<CreditPackPurchaseRow>(
        `
          SELECT ${this.creditPackPurchaseColumns}
          FROM credit_pack_purchases
          WHERE user_id = $1
            AND idempotency_key = $2
          FOR UPDATE;
        `,
        [userId, dto.idempotencyKey],
      );
      let purchase = existingResult.rows[0];
      if (purchase && purchase.offer_code !== offer.offer_code) {
        throw new ConflictException(
          'The credit-pack idempotency key is already used for another offer.',
        );
      }

      if (!purchase) {
        const snapshot = {
          offerCode: offer.offer_code,
          name: offer.name,
          type: offer.offer_type,
          priceCents: offer.price_cents,
          currency: offer.currency.toLowerCase(),
          creditAmount: offer.creditAmount,
          source: 'pricing_catalog',
        };
        const inserted = await transaction.query<CreditPackPurchaseRow>(
          `
            INSERT INTO credit_pack_purchases (
              user_id,
              pricing_catalog_id,
              offer_code,
              status,
              amount_cents,
              currency,
              credit_amount,
              pricing_snapshot,
              idempotency_key
            )
            VALUES (
              $1, $2, $3, 'pending', $4, $5, $6, $7::jsonb, $8
            )
            ON CONFLICT (user_id, idempotency_key) DO NOTHING
            RETURNING ${this.creditPackPurchaseColumns};
          `,
          [
            userId,
            offer.id,
            offer.offer_code,
            offer.price_cents,
            offer.currency.toLowerCase(),
            offer.creditAmount,
            JSON.stringify(snapshot),
            dto.idempotencyKey,
          ],
        );
        purchase = inserted.rows[0];
        if (!purchase) {
          const raced = await transaction.query<CreditPackPurchaseRow>(
            `
              SELECT ${this.creditPackPurchaseColumns}
              FROM credit_pack_purchases
              WHERE user_id = $1
                AND idempotency_key = $2
              FOR UPDATE;
            `,
            [userId, dto.idempotencyKey],
          );
          purchase = raced.rows[0];
          if (!purchase || purchase.offer_code !== offer.offer_code) {
            throw new ConflictException(
              'The credit-pack idempotency key is already used for another offer.',
            );
          }
        }
      }

      const activePayment = await this.findActiveCreditPackPayment(
        transaction,
        purchase.id,
      );
      if (purchase.status === 'paid') {
        const payment =
          activePayment ??
          (await this.findLatestCreditPackPayment(transaction, purchase.id));
        if (!payment) {
          throw new ConflictException(
            'The completed credit-pack purchase has no payment record.',
          );
        }
        return {
          purchase,
          payment,
          customer: null,
          idempotentReplay: true,
        };
      }
      if (purchase.status === 'checkout_started') {
        if (!activePayment || activePayment.status !== 'checkout_started') {
          throw new ConflictException(
            'The credit-pack checkout state is inconsistent. Contact support.',
          );
        }
        return {
          purchase,
          payment: activePayment,
          customer: null,
          idempotentReplay: true,
        };
      }
      if (activePayment) {
        if (activePayment.status !== 'creating') {
          throw new ConflictException(
            'An active credit-pack checkout already exists.',
          );
        }
        return {
          purchase,
          payment: activePayment,
          customer: await this.findCheckoutCustomer(transaction, userId),
          idempotentReplay: true,
        };
      }
      if (
        ![
          'pending',
          'payment_failed',
          'payment_canceled',
          'checkout_expired',
        ].includes(purchase.status)
      ) {
        throw new ConflictException(
          `Credit-pack checkout cannot start from ${purchase.status}.`,
        );
      }

      const attemptResult = await transaction.query<{
        attempt_number: number;
      }>(
        `
          SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number
          FROM payments
          WHERE credit_pack_purchase_id = $1;
        `,
        [purchase.id],
      );
      const attemptNumber = Number(attemptResult.rows[0]?.attempt_number ?? 1);
      const idempotencyKey = `credit-checkout:${purchase.id}:${provider.mode}:attempt:${attemptNumber}`;
      const paymentResult = await transaction.query<PaymentRow>(
        `
          INSERT INTO payments (
            user_id,
            order_id,
            credit_pack_purchase_id,
            stripe_payment_intent_id,
            offer_code,
            amount_cents,
            currency,
            status,
            metadata,
            provider_mode,
            checkout_session_id,
            capture_method,
            attempt_number,
            idempotency_key
          )
          VALUES (
            $1, NULL, $2, NULL, $3, $4, $5, 'creating', '{}'::jsonb,
            $6, NULL, 'automatic_async', $7, $8
          )
          RETURNING ${this.paymentColumns};
        `,
        [
          purchase.user_id,
          purchase.id,
          purchase.offer_code,
          purchase.amount_cents,
          purchase.currency,
          provider.mode,
          attemptNumber,
          idempotencyKey,
        ],
      );
      return {
        purchase,
        payment: paymentResult.rows[0],
        customer: await this.findCheckoutCustomer(transaction, userId),
        idempotentReplay: false,
      };
    });
  }

  private async prepareCheckout(
    userId: string,
    orderId: string,
    provider: CheckoutProvider,
  ): Promise<PreparedCheckout> {
    return this.databaseService.withTransaction(async (transaction) => {
      const order = await this.ordersService.findOrderRowForUpdate(
        transaction,
        orderId,
        userId,
      );
      const activePayment = await this.findActivePayment(transaction, order.id);
      if (order.status === 'checkout_started') {
        if (!activePayment || activePayment.status !== 'checkout_started') {
          throw new ConflictException(
            'The order checkout state is inconsistent. Contact support.',
          );
        }
        return {
          order,
          payment: activePayment,
          customer: null,
          idempotentReplay: true,
        };
      }

      this.ordersService.assertOrderStatus(
        order,
        ['pending', 'payment_failed', 'payment_canceled', 'checkout_expired'],
        'start checkout',
      );
      if (activePayment) {
        if (activePayment.status !== 'creating') {
          throw new ConflictException(
            'An active checkout already exists for this order.',
          );
        }
        const customer = await this.findCheckoutCustomer(transaction, userId);
        return {
          order,
          payment: activePayment,
          customer,
          idempotentReplay: true,
        };
      }

      const attemptResult = await transaction.query<{ attempt_number: number }>(
        `
          SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number
          FROM payments
          WHERE order_id = $1;
        `,
        [order.id],
      );
      const attemptNumber = Number(attemptResult.rows[0]?.attempt_number ?? 1);
      const captureMethod: CheckoutCaptureMethod =
        provider.mode === 'stripe' &&
        order.offer_code === 'try_risk_free_one_card'
          ? 'manual'
          : 'automatic_async';
      const idempotencyKey = `checkout:${order.id}:${provider.mode}:attempt:${attemptNumber}`;
      const paymentResult = await transaction.query<PaymentRow>(
        `
          INSERT INTO payments (
            user_id,
            order_id,
            stripe_payment_intent_id,
            offer_code,
            amount_cents,
            currency,
            status,
            metadata,
            provider_mode,
            checkout_session_id,
            capture_method,
            attempt_number,
            idempotency_key
          )
          VALUES (
            $1, $2, NULL, $3, $4, $5, 'creating', '{}'::jsonb,
            $6, NULL, $7, $8, $9
          )
          RETURNING ${this.paymentColumns};
        `,
        [
          order.user_id,
          order.id,
          order.offer_code ?? 'try_risk_free_one_card',
          order.amount_cents,
          order.currency,
          provider.mode,
          captureMethod,
          attemptNumber,
          idempotencyKey,
        ],
      );
      const customer = await this.findCheckoutCustomer(transaction, userId);
      return {
        order,
        payment: paymentResult.rows[0],
        customer,
        idempotentReplay: false,
      };
    });
  }

  private async processCheckoutSessionEvent(
    transaction: DatabaseTransaction,
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ) {
    const payment = await this.findStripePaymentFromMetadata(
      transaction,
      session.metadata,
    );
    if (
      payment.checkout_session_id &&
      payment.checkout_session_id !== session.id
    ) {
      throw new ConflictException(
        'Stripe Checkout Session does not match the local payment.',
      );
    }
    const paymentIntentId = this.idOf(session.payment_intent);
    const customerId = this.idOf(session.customer);
    if (customerId) {
      await transaction.query(
        `
          UPDATE users
          SET stripe_customer_id = $2, updated_at = NOW()
          WHERE id = $1
            AND (stripe_customer_id IS NULL OR stripe_customer_id = $2);
        `,
        [payment.user_id, customerId],
      );
    }

    if (event.type === 'checkout.session.expired') {
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'expired',
        'checkout_expired',
        event,
        paymentIntentId,
        0,
        {
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
        },
      );
      return;
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'failed',
        'payment_failed',
        event,
        paymentIntentId,
        0,
        {
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
        },
      );
      return;
    }
    if (session.payment_status === 'paid') {
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'succeeded',
        payment.finalization_action === 'not_send' ? 'closed_no_send' : 'paid',
        event,
        paymentIntentId,
        session.amount_total ?? payment.amount_cents,
        {
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
        },
        session.amount_total ?? payment.amount_cents,
      );
      return;
    }

    await transaction.query(
      `
        UPDATE payments
        SET
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
          updated_at = NOW()
        WHERE id = $1;
      `,
      [
        payment.id,
        paymentIntentId,
        JSON.stringify({
          stripeEventId: event.id,
          sessionStatus: session.status,
          paymentStatus: session.payment_status,
        }),
      ],
    );
  }

  private async processPaymentIntentEvent(
    transaction: DatabaseTransaction,
    event: Stripe.Event,
    intent: Stripe.PaymentIntent,
  ) {
    const payment = await this.findStripePaymentFromMetadata(
      transaction,
      intent.metadata,
      intent.id,
    );
    if (
      payment.stripe_payment_intent_id &&
      payment.stripe_payment_intent_id !== intent.id
    ) {
      throw new ConflictException(
        'Stripe PaymentIntent does not match the local payment.',
      );
    }
    const providerMetadata = {
      paymentIntentStatus: intent.status,
      amount: intent.amount,
      amountCapturable: intent.amount_capturable,
      amountReceived: intent.amount_received,
      currency: intent.currency,
    };

    if (event.type === 'payment_intent.amount_capturable_updated') {
      const decisionDueAt = await this.authorizationDecisionDueAt(
        transaction,
        payment,
        event,
      );
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'authorized',
        'payment_authorized',
        event,
        intent.id,
        0,
        providerMetadata,
        intent.amount,
        decisionDueAt,
      );
      return;
    }
    if (event.type === 'payment_intent.succeeded') {
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'succeeded',
        payment.finalization_action === 'not_send' ? 'closed_no_send' : 'paid',
        event,
        intent.id,
        intent.amount_received,
        providerMetadata,
        intent.amount,
      );
      return;
    }
    if (event.type === 'payment_intent.payment_failed') {
      await this.applyProviderPaymentState(
        transaction,
        payment,
        'failed',
        'payment_failed',
        event,
        intent.id,
        intent.amount_received,
        providerMetadata,
        intent.amount,
      );
      return;
    }
    await this.applyProviderPaymentState(
      transaction,
      payment,
      'canceled',
      payment.finalization_action === 'not_send'
        ? 'closed_no_send'
        : 'payment_canceled',
      event,
      intent.id,
      intent.amount_received,
      providerMetadata,
      intent.amount,
    );
  }

  private async applyProviderPaymentState(
    transaction: DatabaseTransaction,
    payment: PaymentRow,
    paymentStatus: string,
    orderStatus:
      | 'payment_authorized'
      | 'paid'
      | 'closed_no_send'
      | 'payment_failed'
      | 'payment_canceled'
      | 'checkout_expired',
    event: Stripe.Event,
    paymentIntentId: string | null,
    amountCapturedCents: number,
    providerMetadata: Record<string, unknown>,
    providerAmountCents?: number,
    decisionDueAt?: Date | null,
  ) {
    const allowedCurrentStatuses: Record<string, string[]> = {
      authorized: ['creating', 'checkout_started', 'authorized'],
      succeeded: [
        'creating',
        'checkout_started',
        'authorized',
        'failed',
        'succeeded',
      ],
      failed: ['creating', 'checkout_started', 'failed'],
      canceled: ['creating', 'checkout_started', 'authorized', 'canceled'],
      expired: ['creating', 'checkout_started', 'expired'],
    };
    const updated = await transaction.query<{ id: string }>(
      `
        UPDATE payments
        SET
          stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
          status = $3,
          amount_cents = COALESCE($4, amount_cents),
          amount_captured_cents = $5,
          metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
          decision_due_at = COALESCE($8::TIMESTAMPTZ, decision_due_at),
          updated_at = NOW()
        WHERE id = $1
          AND status = ANY($7::VARCHAR[])
        RETURNING id;
      `,
      [
        payment.id,
        paymentIntentId,
        paymentStatus,
        providerAmountCents ?? null,
        amountCapturedCents,
        JSON.stringify({ stripeEventId: event.id, ...providerMetadata }),
        allowedCurrentStatuses[paymentStatus] ?? [],
        decisionDueAt ?? null,
      ],
    );
    if (!updated.rows[0]) return;
    if (payment.credit_pack_purchase_id) {
      await this.applyCreditPackProviderState(
        transaction,
        payment,
        paymentStatus,
        event,
        amountCapturedCents,
      );
      return;
    }
    if (!payment.order_id) {
      throw new ConflictException(
        'Stripe payment is not connected to an order or credit-pack purchase.',
      );
    }
    const updatedOrder = await transaction.query<{
      id: string;
      user_id: string;
      status: string;
      quantity: number;
      amount_cents: number;
      currency: string;
    }>(
      `
        UPDATE orders
        SET status = $2, payment_id = $3, updated_at = NOW()
        WHERE id = $1
          AND status IN (
            'pending',
            'checkout_started',
            'payment_authorized',
            'payment_failed',
            'payment_canceled',
            'checkout_expired',
            'paid',
            'closed_no_send'
          )
        RETURNING id, user_id, status, quantity, amount_cents, currency;
      `,
      [payment.order_id, orderStatus, payment.id],
    );
    if (!updatedOrder.rows[0]) return;
    await this.writeAudit(
      transaction,
      payment.user_id,
      `stripe_${event.type.replace(/\./g, '_')}`,
      'order',
      payment.order_id,
      {
        stripeEventId: event.id,
        paymentId: payment.id,
        paymentStatus,
        orderStatus,
      },
    );
    if (orderStatus === 'paid') {
      const order = updatedOrder.rows[0];
      await this.notificationsService.enqueueOrderNotification(transaction, {
        eventType: 'order_confirmation',
        userId: order.user_id,
        orderId: order.id,
        orderStatus: order.status,
        quantity: order.quantity,
        amountCents: order.amount_cents,
        currency: order.currency,
      });
    }
  }

  private async applyCreditPackProviderState(
    transaction: DatabaseTransaction,
    payment: PaymentRow,
    paymentStatus: string,
    event: Stripe.Event,
    amountCapturedCents: number,
  ) {
    if (!payment.credit_pack_purchase_id) {
      throw new ConflictException(
        'Stripe payment is not connected to a credit-pack purchase.',
      );
    }
    const purchaseResult = await transaction.query<CreditPackPurchaseRow>(
      `
        SELECT ${this.creditPackPurchaseColumns}
        FROM credit_pack_purchases
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE;
      `,
      [payment.credit_pack_purchase_id, payment.user_id],
    );
    const purchase = purchaseResult.rows[0];
    if (!purchase) {
      throw new ConflictException(
        'Stripe credit-pack purchase could not be reconciled.',
      );
    }

    const statusByPayment: Record<string, CreditPackPurchaseRow['status']> = {
      authorized: 'checkout_started',
      succeeded: 'paid',
      failed: 'payment_failed',
      canceled: 'payment_canceled',
      expired: 'checkout_expired',
    };
    const purchaseStatus = statusByPayment[paymentStatus];
    if (!purchaseStatus) {
      throw new ConflictException(
        `Unsupported credit-pack payment state ${paymentStatus}.`,
      );
    }
    if (
      purchaseStatus === 'paid' &&
      amountCapturedCents !== purchase.amount_cents
    ) {
      throw new ConflictException(
        'Stripe credit-pack payment amount does not match the catalog snapshot.',
      );
    }

    const updatedResult = await transaction.query<CreditPackPurchaseRow>(
      `
        UPDATE credit_pack_purchases
        SET status = $2, payment_id = $3, updated_at = NOW()
        WHERE id = $1
          AND status IN (
            'pending',
            'checkout_started',
            'payment_failed',
            'payment_canceled',
            'checkout_expired',
            'paid'
          )
        RETURNING ${this.creditPackPurchaseColumns};
      `,
      [purchase.id, purchaseStatus, payment.id],
    );
    const updatedPurchase = updatedResult.rows[0];
    if (!updatedPurchase) return;

    if (purchaseStatus === 'paid') {
      await this.creditsService.grantOnceInTransaction(
        transaction,
        updatedPurchase.user_id,
        updatedPurchase.credit_amount,
        updatedPurchase.offer_code,
        `credit-pack-purchase:${updatedPurchase.id}`,
        'credit_pack_purchase',
      );
    }
    await this.writeAudit(
      transaction,
      updatedPurchase.user_id,
      `stripe_credit_pack_${event.type.replace(/\./g, '_')}`,
      'credit_pack_purchase',
      updatedPurchase.id,
      {
        stripeEventId: event.id,
        paymentId: payment.id,
        paymentStatus,
        purchaseStatus,
        creditAmount: updatedPurchase.credit_amount,
      },
    );
  }

  private async findStripePaymentFromMetadata(
    transaction: DatabaseTransaction,
    metadata: Stripe.Metadata | null,
    paymentIntentId?: string,
  ) {
    const paymentId = metadata?.souvenotePaymentId;
    const orderId = metadata?.souvenoteOrderId;
    const creditPackPurchaseId = metadata?.souvenoteCreditPackPurchaseId;
    if (
      !paymentId ||
      (!orderId && !creditPackPurchaseId) ||
      (orderId && creditPackPurchaseId)
    ) {
      throw new BadRequestException(
        'Stripe event is missing Souvenote reconciliation metadata.',
      );
    }
    const result = await transaction.query<PaymentRow>(
      `
        SELECT ${this.paymentColumns}
        FROM payments
        WHERE id = $1
          AND (
            ($2::UUID IS NOT NULL AND order_id = $2)
            OR
            ($3::UUID IS NOT NULL AND credit_pack_purchase_id = $3)
          )
          AND provider_mode = 'stripe'
          AND ($4::VARCHAR IS NULL OR stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = $4)
        FOR UPDATE;
      `,
      [
        paymentId,
        orderId ?? null,
        creditPackPurchaseId ?? null,
        paymentIntentId ?? null,
      ],
    );
    const payment = result.rows[0];
    if (!payment) {
      throw new BadRequestException(
        'Stripe event does not match a Souvenote payment.',
      );
    }
    return payment;
  }

  private async findActivePayment(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<PaymentRow>(
      `
        SELECT ${this.paymentColumns}
        FROM payments
        WHERE order_id = $1
          AND status IN ('creating', 'checkout_started', 'authorized')
        ORDER BY attempt_number DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [orderId],
    );
    return result.rows[0];
  }

  private async findLatestPayment(
    transaction: DatabaseTransaction,
    orderId: string,
    forUpdate: boolean,
  ) {
    const result = await transaction.query<PaymentRow>(
      `
        SELECT ${this.paymentColumns}
        FROM payments
        WHERE order_id = $1
        ORDER BY attempt_number DESC
        LIMIT 1
        ${forUpdate ? 'FOR UPDATE' : ''};
      `,
      [orderId],
    );
    return result.rows[0];
  }

  private async findCreditPackPurchaseForUpdate(
    transaction: DatabaseTransaction,
    purchaseId: string,
    userId: string,
  ) {
    const result = await transaction.query<CreditPackPurchaseRow>(
      `
        SELECT ${this.creditPackPurchaseColumns}
        FROM credit_pack_purchases
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE;
      `,
      [purchaseId, userId],
    );
    const purchase = result.rows[0];
    if (!purchase) {
      throw new BadRequestException('Credit-pack purchase was not found.');
    }
    return purchase;
  }

  private async findActiveCreditPackPayment(
    transaction: DatabaseTransaction,
    purchaseId: string,
  ) {
    const result = await transaction.query<PaymentRow>(
      `
        SELECT ${this.paymentColumns}
        FROM payments
        WHERE credit_pack_purchase_id = $1
          AND status IN ('creating', 'checkout_started')
        ORDER BY attempt_number DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [purchaseId],
    );
    return result.rows[0];
  }

  private async findLatestCreditPackPayment(
    transaction: DatabaseTransaction,
    purchaseId: string,
  ) {
    const result = await transaction.query<PaymentRow>(
      `
        SELECT ${this.paymentColumns}
        FROM payments
        WHERE credit_pack_purchase_id = $1
        ORDER BY attempt_number DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [purchaseId],
    );
    return result.rows[0];
  }

  private async findCheckoutCustomer(
    transaction: DatabaseTransaction,
    userId: string,
  ) {
    const result = await transaction.query<CheckoutCustomerRow>(
      `
        SELECT email, stripe_customer_id
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL;
      `,
      [userId],
    );
    const customer = result.rows[0];
    if (!customer) {
      throw new BadRequestException('Checkout customer was not found.');
    }
    return customer;
  }

  private async markCheckoutStartFailed(
    order: OrderRow,
    payment: PaymentRow,
    error: unknown,
  ) {
    await this.databaseService.withTransaction(async (transaction) => {
      const failed = await transaction.query<{ id: string }>(
        `
          UPDATE payments
          SET
            status = 'failed',
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
          WHERE id = $1
            AND status = 'creating'
          RETURNING id;
        `,
        [
          payment.id,
          JSON.stringify({ providerError: this.errorMessage(error) }),
        ],
      );
      if (failed.rows[0]) {
        await this.ordersService.markPaymentState(
          order.id,
          'payment_failed',
          payment.id,
          transaction,
        );
      }
    });
  }

  private async markCreditPackCheckoutStartFailed(
    purchase: CreditPackPurchaseRow,
    payment: PaymentRow,
    error: unknown,
  ) {
    await this.databaseService.withTransaction(async (transaction) => {
      const failed = await transaction.query<{ id: string }>(
        `
          UPDATE payments
          SET
            status = 'failed',
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
          WHERE id = $1
            AND status = 'creating'
          RETURNING id;
        `,
        [
          payment.id,
          JSON.stringify({ providerError: this.errorMessage(error) }),
        ],
      );
      if (failed.rows[0]) {
        await transaction.query(
          `
            UPDATE credit_pack_purchases
            SET status = 'payment_failed', payment_id = $2, updated_at = NOW()
            WHERE id = $1
              AND status IN ('pending', 'payment_failed');
          `,
          [purchase.id, payment.id],
        );
      }
    });
  }

  private async completeWebhookEvent(
    transaction: DatabaseTransaction,
    eventId: string,
    status: 'processed' | 'ignored',
  ) {
    await transaction.query(
      `
        UPDATE stripe_webhook_events
        SET status = $2, processed_at = NOW(), updated_at = NOW()
        WHERE event_id = $1;
      `,
      [eventId, status],
    );
  }

  private async writeAudit(
    transaction: DatabaseTransaction,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await transaction.query(
      `
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5::jsonb);
      `,
      [userId, action, entityType, entityId, JSON.stringify(metadata)],
    );
  }

  private buildCheckoutResponse(
    order: OrderRow,
    payment: PaymentRow,
    idempotentReplay: boolean,
  ) {
    return {
      checkoutSession: {
        id: payment.checkout_session_id,
        orderId: order.id,
        paymentId: payment.id,
        providerMode: payment.provider_mode,
        status:
          payment.status === 'succeeded_mock' ? 'paid_mock' : payment.status,
        captureMethod: payment.capture_method,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        checkoutUrl:
          typeof payment.metadata?.checkoutUrl === 'string'
            ? payment.metadata.checkoutUrl
            : null,
        expiresAt: this.toIso(payment.expires_at),
        paidAt:
          typeof payment.metadata?.paidMockAt === 'string'
            ? payment.metadata.paidMockAt
            : null,
        createdAt: this.toIso(payment.created_at),
      },
      order: this.ordersService.toOrderResponse(order),
      idempotentReplay,
    };
  }

  private buildCreditPackCheckoutResponse(
    purchase: CreditPackPurchaseRow,
    payment: PaymentRow,
    idempotentReplay: boolean,
  ) {
    return {
      checkoutSession: {
        id: payment.checkout_session_id,
        creditPackPurchaseId: purchase.id,
        paymentId: payment.id,
        providerMode: payment.provider_mode,
        status:
          payment.status === 'succeeded_mock' ? 'paid_mock' : payment.status,
        captureMethod: payment.capture_method,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        checkoutUrl:
          typeof payment.metadata?.checkoutUrl === 'string'
            ? payment.metadata.checkoutUrl
            : null,
        expiresAt: this.toIso(payment.expires_at),
        paidAt:
          typeof payment.metadata?.paidMockAt === 'string'
            ? payment.metadata.paidMockAt
            : null,
        createdAt: this.toIso(payment.created_at),
      },
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
      idempotentReplay,
    };
  }

  private toPaymentResponse(payment: PaymentRow) {
    return {
      id: payment.id,
      orderId: payment.order_id,
      creditPackPurchaseId: payment.credit_pack_purchase_id,
      providerMode: payment.provider_mode,
      status: payment.status,
      captureMethod: payment.capture_method,
      amountCents: payment.amount_cents,
      amountCapturedCents: payment.amount_captured_cents,
      currency: payment.currency,
      finalizationAction: payment.finalization_action,
      decisionDueAt: this.toIso(payment.decision_due_at),
      createdAt: this.toIso(payment.created_at),
      updatedAt: this.toIso(payment.updated_at),
    };
  }

  private resolvePricing(order: OrderRow) {
    const snapshot = order.pricing_snapshot ?? {};
    const unitAmountCents = Number(snapshot.unitAmountCents);
    const offerCode =
      typeof snapshot.offerCode === 'string'
        ? snapshot.offerCode
        : order.offer_code;
    const productName =
      typeof snapshot.name === 'string' ? snapshot.name : 'Souvenote card';
    if (
      !offerCode ||
      !Number.isInteger(unitAmountCents) ||
      unitAmountCents <= 0 ||
      unitAmountCents * order.quantity !== order.amount_cents
    ) {
      throw new ConflictException(
        'Order pricing snapshot does not match the stored total.',
      );
    }
    return { unitAmountCents, offerCode, productName };
  }

  private resolveCreditPackPricing(purchase: CreditPackPurchaseRow) {
    const snapshot = purchase.pricing_snapshot ?? {};
    const offerCode =
      typeof snapshot.offerCode === 'string' ? snapshot.offerCode : null;
    const productName =
      typeof snapshot.name === 'string' ? snapshot.name : 'Souvenote credits';
    const priceCents = Number(snapshot.priceCents);
    const creditAmount = Number(snapshot.creditAmount);
    if (
      offerCode !== purchase.offer_code ||
      !Number.isInteger(priceCents) ||
      priceCents !== purchase.amount_cents ||
      !Number.isInteger(creditAmount) ||
      creditAmount !== purchase.credit_amount ||
      String(snapshot.currency).toLowerCase() !==
        purchase.currency.toLowerCase()
    ) {
      throw new ConflictException(
        'Credit-pack pricing snapshot does not match the stored purchase.',
      );
    }
    return { productName };
  }

  private noSendFee(order: OrderRow) {
    const metadata = this.record(order.pricing_snapshot?.metadata);
    const configured = metadata?.no_send_fee_cents;
    if (configured === undefined) return 0;
    const fee = Number(configured);
    if (!Number.isInteger(fee) || fee < 0 || fee > order.amount_cents) {
      throw new ConflictException(
        'The no-send fee in the order pricing snapshot is invalid.',
      );
    }
    return fee;
  }

  private async authorizationDecisionDueAt(
    transaction: DatabaseTransaction,
    payment: PaymentRow,
    event: Stripe.Event,
  ) {
    if (payment.capture_method !== 'manual' || !payment.order_id) return null;
    const result = await transaction.query<{
      pricing_snapshot: Record<string, unknown>;
    }>(
      `
        SELECT pricing_snapshot
        FROM orders
        WHERE id = $1;
      `,
      [payment.order_id],
    );
    const snapshot = result.rows[0]?.pricing_snapshot;
    const metadata = this.record(snapshot?.metadata);
    const holdDays = Number(metadata?.hold_days);
    if (
      metadata?.decision_window_starts_at !== 'payment_authorized' ||
      !Number.isInteger(holdDays) ||
      holdDays < 1 ||
      holdDays > 30 ||
      !Number.isInteger(event.created) ||
      event.created <= 0
    ) {
      throw new ConflictException(
        'The authorization decision policy is missing or invalid.',
      );
    }
    return new Date((event.created + holdDays * 24 * 60 * 60) * 1000);
  }

  private checkoutRedirectUrl(
    kind: 'success' | 'cancel',
    providerMode: CheckoutProviderMode,
  ) {
    const setting =
      kind === 'success' ? 'CHECKOUT_SUCCESS_URL' : 'CHECKOUT_CANCEL_URL';
    const fallback =
      kind === 'success'
        ? 'http://localhost:3000/delivery?checkout=success&session_id={CHECKOUT_SESSION_ID}'
        : 'http://localhost:3000/delivery?checkout=cancel';
    const configured = this.configService.get<string>(setting)?.trim();
    const value = configured || fallback;
    if (providerMode === 'stripe' && !configured) {
      throw new InternalServerErrorException(
        `${setting} is required in Stripe checkout mode.`,
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new InternalServerErrorException(`${setting} must be a valid URL.`);
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    const production =
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ===
      'production';
    if (
      parsed.protocol !== 'https:' &&
      !(local && parsed.protocol === 'http:' && !production)
    ) {
      throw new InternalServerErrorException(
        `${setting} must use HTTPS outside local development.`,
      );
    }
    if (parsed.username || parsed.password) {
      throw new InternalServerErrorException(
        `${setting} must not include URL credentials.`,
      );
    }
    if (kind === 'success' && !value.includes('{CHECKOUT_SESSION_ID}')) {
      throw new InternalServerErrorException(
        'CHECKOUT_SUCCESS_URL must include {CHECKOUT_SESSION_ID}.',
      );
    }
    return value;
  }

  private creditCheckoutRedirectUrl(
    kind: 'success' | 'cancel',
    providerMode: CheckoutProviderMode,
  ) {
    const setting =
      kind === 'success'
        ? 'CREDIT_CHECKOUT_SUCCESS_URL'
        : 'CREDIT_CHECKOUT_CANCEL_URL';
    const fallback =
      kind === 'success'
        ? 'http://localhost:3000/cart?checkout=success&session_id={CHECKOUT_SESSION_ID}'
        : 'http://localhost:3000/cart?checkout=cancel';
    const configured = this.configService.get<string>(setting)?.trim();
    const value = configured || fallback;
    if (providerMode === 'stripe' && !configured) {
      throw new InternalServerErrorException(
        `${setting} is required in Stripe checkout mode.`,
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new InternalServerErrorException(`${setting} must be a valid URL.`);
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    const production =
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ===
      'production';
    if (
      parsed.protocol !== 'https:' &&
      !(local && parsed.protocol === 'http:' && !production)
    ) {
      throw new InternalServerErrorException(
        `${setting} must use HTTPS outside local development.`,
      );
    }
    if (parsed.username || parsed.password) {
      throw new InternalServerErrorException(
        `${setting} must not include URL credentials.`,
      );
    }
    if (kind === 'success' && !value.includes('{CHECKOUT_SESSION_ID}')) {
      throw new InternalServerErrorException(
        'CREDIT_CHECKOUT_SUCCESS_URL must include {CHECKOUT_SESSION_ID}.',
      );
    }
    return value;
  }

  private readBoolean(key: string, fallback: boolean) {
    const configured = this.configService
      .get<string>(key)
      ?.trim()
      .toLowerCase();
    if (!configured) return fallback;
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    throw new InternalServerErrorException(`${key} must be true or false.`);
  }

  private record(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private idOf(value: string | { id: string } | null) {
    if (!value) return null;
    return typeof value === 'string' ? value : value.id;
  }

  private errorMessage(error: unknown) {
    return (
      error instanceof Error ? error.message : 'Unknown provider error'
    ).slice(0, 500);
  }

  private toIso(value: Date | string | null) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  private get paymentColumns() {
    return `
      id,
      user_id,
      order_id,
      credit_pack_purchase_id,
      stripe_payment_intent_id,
      offer_code,
      amount_cents,
      currency,
      status,
      metadata,
      provider_mode,
      checkout_session_id,
      capture_method,
      attempt_number,
      idempotency_key,
      amount_captured_cents,
      finalization_action,
      decision_due_at,
      finalization_claimed_at,
      expires_at,
      created_at,
      updated_at
    `;
  }

  private get creditPackPurchaseColumns() {
    return `
      id,
      user_id,
      pricing_catalog_id,
      offer_code,
      status,
      amount_cents,
      currency,
      credit_amount,
      pricing_snapshot,
      idempotency_key,
      checkout_session_id,
      payment_id,
      created_at,
      updated_at
    `;
  }
}
