import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { PricingService } from '../pricing/pricing.service';
import { CardEntitlementsService } from '../card-entitlements/card-entitlements.service';
import { CreateOrderDto, PostalAddressDto } from './orders.controller';

export type OrderStatus =
  | 'pending'
  | 'checkout_started'
  | 'payment_authorized'
  | 'paid'
  | 'paid_mock'
  | 'closed_no_send'
  | 'payment_failed'
  | 'payment_canceled'
  | 'checkout_expired'
  | 'fulfillment_started'
  | 'fulfillment_submitted'
  | 'printing'
  | 'shipped'
  | 'delivered'
  | 'fulfillment_on_hold'
  | 'fulfillment_failed'
  | 'fulfilled_mock'
  | 'failed_mock';

export type OrderRow = {
  id: string;
  user_id: string;
  card_draft_id: string | null;
  selected_asset_id: string | null;
  status: OrderStatus;
  scribeless_job_id: string | null;
  tracking_url: string | null;
  recipient_address: Record<string, unknown> | null;
  recipient_addresses: Record<string, unknown>[];
  sender_address: Record<string, unknown> | null;
  qr_code_url: string | null;
  offer_code: string | null;
  amount_cents: number;
  currency: string;
  quantity: number;
  pricing_snapshot: Record<string, unknown>;
  checkout_session_id: string | null;
  payment_id: string | null;
  fulfillment_job_id: string | null;
  fulfillment_status_updated_at: Date | string | null;
  funding_source?: 'checkout' | 'card_bank';
  card_entitlements_reserved_at?: Date | string | null;
  card_entitlements_released_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pricingService: PricingService,
    private readonly cardEntitlementsService: CardEntitlementsService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    await this.ensureCardDraftExists(userId, dto.cardDraftId);
    await this.ensureSelectedAssetExists(
      userId,
      dto.cardDraftId,
      dto.selectedAssetId,
    );
    const quantity = dto.quantity ?? dto.recipientAddresses?.length ?? 1;
    const recipientAddresses = dto.recipientAddresses?.length
      ? dto.recipientAddresses
      : Array.from({ length: quantity }, () => dto.recipientAddress);
    if (recipientAddresses.length !== quantity) {
      throw new BadRequestException(
        'The number of recipient addresses must match the priced order quantity.',
      );
    }
    if (dto.fundingSource === 'card_bank') {
      return this.createCardBankOrder(
        userId,
        dto,
        quantity,
        recipientAddresses,
      );
    }
    const offer = await this.pricingService.resolveOrderOffer(
      dto.offerCode,
      quantity,
    );
    const amountCents = offer.price_cents * quantity;
    if (!Number.isSafeInteger(amountCents) || amountCents > 2_147_483_647) {
      throw new BadRequestException(
        'The selected pricing offer total is not configured correctly.',
      );
    }
    const currency = offer.currency.trim().toLowerCase();
    const pricingSnapshot = {
      catalogOfferId: offer.id,
      offerCode: offer.offer_code,
      name: offer.name,
      type: offer.offer_type,
      unitAmountCents: offer.price_cents,
      quantity,
      totalAmountCents: amountCents,
      currency,
      creditsPerCard: offer.credits_per_card,
      shippingIncluded: offer.shipping_included,
      metadata: offer.metadata ?? {},
    };

    const result = await this.databaseService.query<OrderRow>(
      `
        INSERT INTO orders (
          user_id,
          card_draft_id,
          selected_asset_id,
          status,
          recipient_address,
          recipient_addresses,
          sender_address,
          qr_code_url,
          offer_code,
          amount_cents,
          currency,
          quantity,
          pricing_snapshot
        )
        VALUES (
          $1,
          $2,
          $3,
          'pending',
          $4::jsonb,
          $5::jsonb,
          $6::jsonb,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::jsonb
        )
        RETURNING ${this.orderColumns};
      `,
      [
        userId,
        dto.cardDraftId,
        dto.selectedAssetId,
        JSON.stringify(recipientAddresses[0] ?? {}),
        JSON.stringify(recipientAddresses),
        JSON.stringify(dto.senderAddress),
        `mock://souvenote/qr/${dto.selectedAssetId}`,
        offer.offer_code,
        amountCents,
        currency,
        quantity,
        JSON.stringify(pricingSnapshot),
      ],
    );

    return {
      order: this.toOrderResponse(result.rows[0]),
    };
  }

  async getOrderById(userId: string, orderId: string) {
    return {
      order: this.toOrderResponse(await this.findOrderRow(orderId, userId)),
    };
  }

  async listOrders(userId: string) {
    const result = await this.databaseService.query<OrderRow>(
      `
        SELECT ${this.orderColumns}
        FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC;
      `,
      [userId],
    );

    return {
      userId,
      orders: result.rows.map((order) => this.toOrderResponse(order)),
    };
  }

  async findOrderRow(orderId: string, userId?: string) {
    return this.findOrderRowWith(this.databaseService, orderId, userId, false);
  }

  async findOrderRowForUpdate(
    transaction: DatabaseTransaction,
    orderId: string,
    userId?: string,
  ) {
    return this.findOrderRowWith(transaction, orderId, userId, true);
  }

  private async findOrderRowWith(
    queryable: DatabaseTransaction,
    orderId: string,
    userId: string | undefined,
    forUpdate: boolean,
  ) {
    const ownershipClause = userId ? 'AND user_id = $2' : '';
    const result = await queryable.query<OrderRow>(
      `
        SELECT ${this.orderColumns}
        FROM orders
        WHERE id = $1
          ${ownershipClause}
        ${forUpdate ? 'FOR UPDATE' : ''};
      `,
      userId ? [orderId, userId] : [orderId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    return result.rows[0];
  }

  async markCheckoutStarted(
    orderId: string,
    checkoutSessionId: string,
    paymentId: string,
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      'checkout_started',
      {
        checkoutSessionId,
        paymentId,
      },
    );
  }

  async markPaidMock(
    orderId: string,
    paymentId: string,
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      'paid_mock',
      { paymentId },
    );
  }

  async markPaymentState(
    orderId: string,
    status:
      | 'payment_authorized'
      | 'paid'
      | 'closed_no_send'
      | 'payment_failed'
      | 'payment_canceled'
      | 'checkout_expired',
    paymentId: string,
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      status,
      { paymentId },
    );
  }

  async markFulfillmentStarted(
    orderId: string,
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      'fulfillment_started',
      {},
    );
  }

  async markFulfillmentState(
    orderId: string,
    status:
      | 'fulfillment_submitted'
      | 'printing'
      | 'shipped'
      | 'delivered'
      | 'fulfillment_on_hold'
      | 'fulfillment_failed',
    fields: {
      fulfillmentJobId?: string;
      scribelessJobId?: string;
      trackingUrl?: string;
    },
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      status,
      fields,
    );
  }

  async markFulfilledMock(
    orderId: string,
    fulfillmentJobId: string,
    scribelessJobId: string,
    transaction?: DatabaseTransaction,
  ) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      'fulfilled_mock',
      {
        fulfillmentJobId,
        scribelessJobId,
      },
    );
  }

  async markFailedMock(orderId: string, transaction?: DatabaseTransaction) {
    return this.updateOrder(
      transaction ?? this.databaseService,
      orderId,
      'failed_mock',
      {},
    );
  }

  assertOrderStatus(
    order: OrderRow,
    allowedStatuses: OrderStatus[],
    action: string,
  ) {
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order must be in ${allowedStatuses.join(' or ')} status to ${action}. Current status: ${order.status}.`,
      );
    }
  }

  toOrderResponse(row: OrderRow) {
    return {
      id: row.id,
      userId: row.user_id,
      cardDraftId: row.card_draft_id,
      selectedAssetId: row.selected_asset_id,
      status: row.status,
      offerCode: row.offer_code,
      amountCents: row.amount_cents,
      currency: row.currency,
      quantity: row.quantity,
      pricingSnapshot: row.pricing_snapshot ?? {},
      checkoutSessionId: row.checkout_session_id,
      paymentId: row.payment_id,
      fulfillmentJobId: row.fulfillment_job_id,
      mockFulfillmentId: row.scribeless_job_id,
      trackingUrl: row.tracking_url,
      recipientAddress: row.recipient_address ?? {},
      recipientAddresses: row.recipient_addresses ?? [],
      senderAddress: row.sender_address ?? {},
      qrCodeUrl: row.qr_code_url,
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
      fulfillmentStatusUpdatedAt: this.toIso(row.fulfillment_status_updated_at),
      fundingSource: row.funding_source ?? 'checkout',
      cardEntitlementsReservedAt: this.toIso(
        row.card_entitlements_reserved_at ?? null,
      ),
      cardEntitlementsReleasedAt: this.toIso(
        row.card_entitlements_released_at ?? null,
      ),
    };
  }

  private get orderColumns() {
    return `
      id,
      user_id,
      card_draft_id,
      selected_asset_id,
      status,
      scribeless_job_id,
      tracking_url,
      recipient_address,
      recipient_addresses,
      sender_address,
      qr_code_url,
      offer_code,
      amount_cents,
      currency,
      quantity,
      pricing_snapshot,
      checkout_session_id,
      payment_id,
      fulfillment_job_id,
      fulfillment_status_updated_at,
      funding_source,
      card_entitlements_reserved_at,
      card_entitlements_released_at,
      created_at,
      updated_at
    `;
  }

  private async updateOrder(
    queryable: DatabaseTransaction,
    orderId: string,
    status: OrderStatus,
    fields: {
      checkoutSessionId?: string;
      paymentId?: string;
      fulfillmentJobId?: string;
      scribelessJobId?: string;
      trackingUrl?: string;
    },
  ) {
    const result = await queryable.query<OrderRow>(
      `
        UPDATE orders
        SET
          status = $2::text,
          checkout_session_id = COALESCE($3, checkout_session_id),
          payment_id = COALESCE($4, payment_id),
          fulfillment_job_id = COALESCE($5, fulfillment_job_id),
          scribeless_job_id = COALESCE($6, scribeless_job_id),
          tracking_url = COALESCE($7, tracking_url),
          fulfillment_status_updated_at = CASE
            WHEN $2::text IN (
              'fulfillment_started',
              'fulfillment_submitted',
              'printing',
              'shipped',
              'delivered',
              'fulfillment_on_hold',
              'fulfillment_failed',
              'fulfilled_mock',
              'failed_mock'
            ) THEN NOW()
            ELSE fulfillment_status_updated_at
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${this.orderColumns};
      `,
      [
        orderId,
        status,
        fields.checkoutSessionId ?? null,
        fields.paymentId ?? null,
        fields.fulfillmentJobId ?? null,
        fields.scribelessJobId ?? null,
        fields.trackingUrl ?? null,
      ],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    return result.rows[0];
  }

  async markCardEntitlementsReserved(
    orderId: string,
    transaction: DatabaseTransaction,
  ) {
    const result = await transaction.query<OrderRow>(
      `
        UPDATE orders
        SET
          card_entitlements_reserved_at = NOW(),
          card_entitlements_released_at = NULL,
          updated_at = NOW()
        WHERE id = $1
          AND funding_source = 'card_bank'
        RETURNING ${this.orderColumns};
      `,
      [orderId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Prepaid order not found.');
    }
    return result.rows[0];
  }

  async markCardEntitlementsReleased(
    orderId: string,
    transaction: DatabaseTransaction,
  ) {
    const result = await transaction.query<OrderRow>(
      `
        UPDATE orders
        SET
          card_entitlements_released_at = COALESCE(
            card_entitlements_released_at,
            NOW()
          ),
          updated_at = NOW()
        WHERE id = $1
          AND funding_source = 'card_bank'
        RETURNING ${this.orderColumns};
      `,
      [orderId],
    );
    return result.rows[0];
  }

  private async createCardBankOrder(
    userId: string,
    dto: CreateOrderDto,
    quantity: number,
    recipientAddresses: PostalAddressDto[],
  ) {
    const pricingSnapshot = {
      offerCode: 'prepaid_card_delivery',
      name: 'Prepaid card delivery',
      type: 'prepaid_card_delivery',
      unitAmountCents: 0,
      quantity,
      totalAmountCents: 0,
      currency: 'cad',
      creditsPerCard: 0,
      shippingIncluded: true,
      printingIncluded: true,
      fundingSource: 'card_bank',
      source: 'card_entitlement_ledger',
    };

    const row = await this.databaseService.withTransaction(
      async (transaction) => {
        const result = await transaction.query<OrderRow>(
          `
            INSERT INTO orders (
              user_id,
              card_draft_id,
              selected_asset_id,
              status,
              recipient_address,
              recipient_addresses,
              sender_address,
              qr_code_url,
              offer_code,
              amount_cents,
              currency,
              quantity,
              pricing_snapshot,
              funding_source,
              card_entitlements_reserved_at
            )
            VALUES (
              $1,
              $2,
              $3,
              'paid',
              $4::jsonb,
              $5::jsonb,
              $6::jsonb,
              $7,
              'prepaid_card_delivery',
              0,
              'cad',
              $8,
              $9::jsonb,
              'card_bank',
              NOW()
            )
            RETURNING ${this.orderColumns};
          `,
          [
            userId,
            dto.cardDraftId,
            dto.selectedAssetId,
            JSON.stringify(recipientAddresses[0] ?? {}),
            JSON.stringify(recipientAddresses),
            JSON.stringify(dto.senderAddress),
            `mock://souvenote/qr/${dto.selectedAssetId}`,
            quantity,
            JSON.stringify(pricingSnapshot),
          ],
        );
        const order = result.rows[0];
        await this.cardEntitlementsService.deductInTransaction(
          transaction,
          userId,
          quantity,
          `order:${order.id}`,
          `order:${order.id}:card-bank-reservation`,
        );
        await transaction.query(
          `
            INSERT INTO audit_logs (
              user_id, action, entity_type, entity_id, metadata
            )
            VALUES ($1, 'card_bank_order_funded', 'order', $2, $3::jsonb);
          `,
          [
            userId,
            order.id,
            JSON.stringify({
              quantity,
              amountChargedCents: 0,
              printingIncluded: true,
              shippingIncluded: true,
            }),
          ],
        );
        return order;
      },
    );
    return { order: this.toOrderResponse(row) };
  }

  private async ensureCardDraftExists(userId: string, cardDraftId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id
        FROM card_drafts
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL;
      `,
      [cardDraftId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Card draft not found.');
    }
  }

  private async ensureSelectedAssetExists(
    userId: string,
    cardDraftId: string,
    selectedAssetId: string,
  ) {
    const result = await this.databaseService.query(
      `
        SELECT id
        FROM assets
        WHERE id = $1
          AND user_id = $2
          AND card_draft_id = $3
          AND generation_job_id IS NOT NULL
          AND asset_type = 'image'
          AND s3_key IS NOT NULL
          AND approved_at IS NOT NULL
          AND moderation_state IN ('approved', 'approved_mock');
      `,
      [selectedAssetId, userId, cardDraftId],
    );

    if (result.rows.length === 0) {
      throw new BadRequestException(
        'Select an approved, moderation-cleared generated image for this order.',
      );
    }
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
