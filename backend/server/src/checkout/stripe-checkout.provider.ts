import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  type ProviderOperation,
  ProviderTelemetryService,
} from '../observability/provider-telemetry.service';
import type {
  CheckoutFinalizationResult,
  CheckoutProvider,
  CheckoutSessionRequest,
} from './checkout.provider';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');
export type StripeClient = Stripe | null;

export function createStripeClient(configService: ConfigService): StripeClient {
  const secretKey = configService.get<string>('STRIPE_SECRET_KEY')?.trim();
  if (!secretKey) return null;

  return new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
    maxNetworkRetries: 2,
    timeout: 30_000,
    typescript: true,
  });
}

@Injectable()
export class StripeCheckoutProvider implements CheckoutProvider {
  readonly mode = 'stripe' as const;

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly configService: ConfigService,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  async createSession(request: CheckoutSessionRequest) {
    const stripe = this.requireClient();
    const metadata = {
      souvenotePaymentId: request.localPaymentId,
      souvenoteUserId: request.userId,
      offerCode: request.offerCode,
      ...(request.orderId ? { souvenoteOrderId: request.orderId } : {}),
      ...(request.creditPackPurchaseId
        ? { souvenoteCreditPackPurchaseId: request.creditPackPurchaseId }
        : {}),
      ...(request.cardPackPurchaseId
        ? { souvenoteCardPackPurchaseId: request.cardPackPurchaseId }
        : {}),
    };
    const clientReferenceId =
      request.orderId ??
      request.creditPackPurchaseId ??
      request.cardPackPurchaseId;
    if (!clientReferenceId) {
      throw new InternalServerErrorException(
        'Checkout requires an order, credit-pack, or card-pack purchase reference.',
      );
    }
    const session = await this.measure('checkout_session_create', () =>
      stripe.checkout.sessions.create(
        {
          mode: 'payment',
          success_url: request.successUrl,
          cancel_url: request.cancelUrl,
          client_reference_id: clientReferenceId,
          ...(request.customerId
            ? { customer: request.customerId }
            : {
                customer_creation: 'always' as const,
                customer_email: request.customerEmail,
              }),
          line_items: [
            {
              price_data: {
                currency: request.currency,
                unit_amount: request.unitAmountCents,
                product_data: {
                  name: request.productName,
                  metadata: { offerCode: request.offerCode },
                },
              },
              quantity: request.quantity,
            },
          ],
          automatic_tax: {
            enabled: this.readBoolean('STRIPE_AUTOMATIC_TAX_ENABLED', true),
          },
          billing_address_collection: 'required',
          allow_promotion_codes: this.readBoolean(
            'STRIPE_ALLOW_PROMOTION_CODES',
            false,
          ),
          payment_intent_data: {
            capture_method: request.captureMethod,
            metadata,
            receipt_email: request.customerEmail,
          },
          ...(request.captureMethod === 'manual'
            ? { payment_method_types: ['card' as const] }
            : {}),
          metadata,
        },
        { idempotencyKey: request.idempotencyKey },
      ),
    );

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a hosted Checkout URL.',
      );
    }
    if (
      session.amount_subtotal !== request.totalAmountCents ||
      session.currency?.toLowerCase() !== request.currency.toLowerCase()
    ) {
      throw new InternalServerErrorException(
        'Stripe Checkout totals do not match the server-priced order.',
      );
    }

    return {
      sessionId: session.id,
      paymentIntentId: this.idOf(session.payment_intent),
      checkoutUrl: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
      providerMetadata: {
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
        amountSubtotal: session.amount_subtotal,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
    };
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    const stripe = this.requireClient();
    for (const webhookSecret of this.webhookSecrets()) {
      try {
        return stripe.webhooks.constructEvent(
          payload,
          signature,
          webhookSecret,
        );
      } catch {
        // Continue through the bounded overlap set during a secret rotation.
      }
    }

    throw new BadRequestException('Stripe webhook signature is invalid.');
  }

  async capturePayment(
    paymentIntentId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<CheckoutFinalizationResult> {
    const intent = await this.measure('payment_capture', () =>
      this.requireClient().paymentIntents.capture(
        paymentIntentId,
        { amount_to_capture: amountCents },
        { idempotencyKey },
      ),
    );
    return this.toFinalizationResult(intent);
  }

  async cancelPayment(
    paymentIntentId: string,
    idempotencyKey: string,
  ): Promise<CheckoutFinalizationResult> {
    const intent = await this.measure('payment_cancel', () =>
      this.requireClient().paymentIntents.cancel(
        paymentIntentId,
        {},
        { idempotencyKey },
      ),
    );
    return this.toFinalizationResult(intent);
  }

  private toFinalizationResult(
    intent: Stripe.PaymentIntent,
  ): CheckoutFinalizationResult {
    return {
      paymentIntentId: intent.id,
      status: intent.status,
      amountCapturedCents: intent.amount_received,
      providerMetadata: {
        amount: intent.amount,
        amountCapturable: intent.amount_capturable,
        amountReceived: intent.amount_received,
        currency: intent.currency,
      },
    };
  }

  private requireClient() {
    if (!this.stripe) {
      throw new InternalServerErrorException(
        'STRIPE_SECRET_KEY is required in Stripe checkout mode.',
      );
    }
    return this.stripe;
  }

  private webhookSecrets() {
    const overlapValue = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRETS')
      ?.trim();
    const legacyValue = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRET')
      ?.trim();
    const overlapSecrets = overlapValue
      ? overlapValue.split(',').map((value) => value.trim())
      : [];

    if (overlapSecrets.some((value) => !value)) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRETS contains an empty entry.',
      );
    }

    const secrets = [
      ...new Set([...overlapSecrets, ...(legacyValue ? [legacyValue] : [])]),
    ];
    if (!secrets.length) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRETS or STRIPE_WEBHOOK_SECRET is required for Stripe webhooks.',
      );
    }
    if (secrets.length > 2) {
      throw new InternalServerErrorException(
        'At most two Stripe webhook secrets may be active during rotation.',
      );
    }
    if (secrets.some((value) => !value.startsWith('whsec_'))) {
      throw new InternalServerErrorException(
        'Stripe webhook secrets must start with whsec_.',
      );
    }
    return secrets;
  }

  private idOf(value: string | { id: string } | null) {
    if (!value) return null;
    return typeof value === 'string' ? value : value.id;
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

  private measure<T>(operation: ProviderOperation, action: () => Promise<T>) {
    return this.providerTelemetry
      ? this.providerTelemetry.measure('stripe', operation, action)
      : action();
  }
}
