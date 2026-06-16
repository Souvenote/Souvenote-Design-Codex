import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { OrdersService } from '../orders/orders.service';
import {
  MockCheckoutSuccessDto,
  StartCheckoutDto,
} from './checkout.controller';

type PaymentRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  stripe_payment_intent_id: string | null;
  offer_code: string;
  amount_cents: number;
  status: string;
  metadata: Record<string, unknown> | null;
  provider_mode: string;
  checkout_session_id: string | null;
  created_at: Date | string;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ordersService: OrdersService,
  ) {}

  async startCheckout(dto: StartCheckoutDto) {
    const order = await this.ordersService.findOrderRow(dto.orderId);
    this.ordersService.assertOrderStatus(order, ['pending'], 'start checkout');

    const checkoutSessionId = `mock_checkout_${randomUUID()}`;
    const checkoutUrl = `mock://souvenote/checkout/${checkoutSessionId}`;

    // TODO(Phase 2): replace this mock payment record with a Stripe Checkout Session.
    const paymentResult = await this.databaseService.query<PaymentRow>(
      `
        INSERT INTO payments (
          user_id,
          order_id,
          stripe_payment_intent_id,
          offer_code,
          amount_cents,
          status,
          metadata,
          provider_mode,
          checkout_session_id
        )
        VALUES ($1, $2, $3, $4, $5, 'checkout_started', $6::jsonb, 'mock', $7)
        RETURNING
          id,
          user_id,
          order_id,
          stripe_payment_intent_id,
          offer_code,
          amount_cents,
          status,
          metadata,
          provider_mode,
          checkout_session_id,
          created_at;
      `,
      [
        order.user_id,
        order.id,
        `mock_payment_intent_${checkoutSessionId}`,
        order.offer_code ?? 'try_risk_free_one_card',
        order.amount_cents,
        JSON.stringify({
          mock: true,
          checkoutUrl,
          successUrl: dto.successUrl ?? null,
          cancelUrl: dto.cancelUrl ?? null,
        }),
        checkoutSessionId,
      ],
    );

    const payment = paymentResult.rows[0];
    const updatedOrder = await this.ordersService.markCheckoutStarted(
      order.id,
      checkoutSessionId,
      payment.id,
    );

    return {
      checkoutSession: {
        id: checkoutSessionId,
        orderId: order.id,
        paymentId: payment.id,
        providerMode: 'mock',
        status: 'checkout_started',
        amountCents: payment.amount_cents,
        currency: order.currency,
        checkoutUrl,
        successUrl: dto.successUrl ?? null,
        cancelUrl: dto.cancelUrl ?? null,
        createdAt: this.toIso(payment.created_at),
      },
      order: this.ordersService.toOrderResponse(updatedOrder),
    };
  }

  async simulateCheckoutSuccess(dto: MockCheckoutSuccessDto) {
    const order = await this.ordersService.findOrderRow(dto.orderId);
    this.ordersService.assertOrderStatus(
      order,
      ['checkout_started'],
      'complete mock checkout',
    );

    if (
      dto.checkoutSessionId &&
      order.checkout_session_id !== dto.checkoutSessionId
    ) {
      throw new BadRequestException(
        'checkoutSessionId does not match this order.',
      );
    }

    const sessionId = dto.checkoutSessionId ?? order.checkout_session_id;

    if (!sessionId) {
      throw new BadRequestException('Order does not have a checkout session.');
    }

    const paymentResult = await this.databaseService.query<PaymentRow>(
      `
        UPDATE payments
        SET
          status = 'succeeded_mock',
          metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE order_id = $1
          AND checkout_session_id = $2
        RETURNING
          id,
          user_id,
          order_id,
          stripe_payment_intent_id,
          offer_code,
          amount_cents,
          status,
          metadata,
          provider_mode,
          checkout_session_id,
          created_at;
      `,
      [
        order.id,
        sessionId,
        JSON.stringify({
          paidMockAt: new Date().toISOString(),
        }),
      ],
    );

    if (paymentResult.rows.length === 0) {
      throw new BadRequestException('Mock checkout session was not found.');
    }

    const payment = paymentResult.rows[0];
    const updatedOrder = await this.ordersService.markPaidMock(
      order.id,
      payment.id,
    );

    return {
      checkoutSession: {
        id: sessionId,
        orderId: order.id,
        paymentId: payment.id,
        providerMode: payment.provider_mode,
        status: 'paid_mock',
        amountCents: payment.amount_cents,
        currency: order.currency,
        checkoutUrl: `mock://souvenote/checkout/${sessionId}`,
        paidAt: payment.metadata?.paidMockAt ?? null,
      },
      order: this.ordersService.toOrderResponse(updatedOrder),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
