import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateOrderDto } from './orders.controller';

export type OrderStatus =
  'pending' | 'checkout_started' | 'paid_mock' | 'fulfillment_started' | 'fulfilled_mock' | 'failed_mock';

export type OrderRow = {
  id: string;
  user_id: string;
  card_draft_id: string | null;
  selected_asset_id: string | null;
  status: OrderStatus;
  scribeless_job_id: string | null;
  tracking_url: string | null;
  recipient_address: Record<string, unknown> | null;
  sender_address: Record<string, unknown> | null;
  qr_code_url: string | null;
  offer_code: string | null;
  amount_cents: number;
  currency: string;
  checkout_session_id: string | null;
  payment_id: string | null;
  fulfillment_job_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class OrdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createOrder(dto: CreateOrderDto) {
    await this.ensureCardDraftExists(dto.userId, dto.cardDraftId);
    await this.ensureSelectedAssetExists(dto.userId, dto.cardDraftId, dto.selectedAssetId);

    const result = await this.databaseService.query<OrderRow>(
      `
        INSERT INTO orders (
          user_id,
          card_draft_id,
          selected_asset_id,
          status,
          recipient_address,
          sender_address,
          qr_code_url,
          offer_code,
          amount_cents,
          currency
        )
        VALUES (
          $1,
          $2,
          $3,
          'pending',
          $4::jsonb,
          $5::jsonb,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING ${this.orderColumns};
      `,
      [
        dto.userId,
        dto.cardDraftId,
        dto.selectedAssetId,
        JSON.stringify(dto.recipientAddress ?? {}),
        JSON.stringify(dto.senderAddress ?? {}),
        `mock://souvenote/qr/${dto.selectedAssetId}`,
        dto.offerCode ?? 'try_risk_free_one_card',
        dto.amountCents ?? 999,
        dto.currency ?? 'usd',
      ],
    );

    return {
      order: this.toOrderResponse(result.rows[0]),
    };
  }

  async getOrderById(orderId: string) {
    return {
      order: this.toOrderResponse(await this.findOrderRow(orderId)),
    };
  }

  async listOrders(userId?: string) {
    const params = userId ? [userId] : [];
    const whereClause = userId ? 'WHERE user_id = $1' : '';

    const result = await this.databaseService.query<OrderRow>(
      `
        SELECT ${this.orderColumns}
        FROM orders
        ${whereClause}
        ORDER BY created_at DESC;
      `,
      params,
    );

    return {
      userId: userId ?? null,
      orders: result.rows.map((order) => this.toOrderResponse(order)),
    };
  }

  async findOrderRow(orderId: string) {
    const result = await this.databaseService.query<OrderRow>(
      `
        SELECT ${this.orderColumns}
        FROM orders
        WHERE id = $1;
      `,
      [orderId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    return result.rows[0];
  }

  async markCheckoutStarted(orderId: string, checkoutSessionId: string, paymentId: string) {
    return this.updateOrder(orderId, 'checkout_started', {
      checkoutSessionId,
      paymentId,
    });
  }

  async markPaidMock(orderId: string, paymentId: string) {
    return this.updateOrder(orderId, 'paid_mock', {
      paymentId,
    });
  }

  async markFulfillmentStarted(orderId: string) {
    return this.updateOrder(orderId, 'fulfillment_started', {});
  }

  async markFulfilledMock(orderId: string, fulfillmentJobId: string, scribelessJobId: string) {
    return this.updateOrder(orderId, 'fulfilled_mock', {
      fulfillmentJobId,
      scribelessJobId,
    });
  }

  async markFailedMock(orderId: string) {
    return this.updateOrder(orderId, 'failed_mock', {});
  }

  assertOrderStatus(order: OrderRow, allowedStatuses: OrderStatus[], action: string) {
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
      checkoutSessionId: row.checkout_session_id,
      paymentId: row.payment_id,
      fulfillmentJobId: row.fulfillment_job_id,
      mockFulfillmentId: row.scribeless_job_id,
      trackingUrl: row.tracking_url,
      recipientAddress: row.recipient_address ?? {},
      senderAddress: row.sender_address ?? {},
      qrCodeUrl: row.qr_code_url,
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
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
      sender_address,
      qr_code_url,
      offer_code,
      amount_cents,
      currency,
      checkout_session_id,
      payment_id,
      fulfillment_job_id,
      created_at,
      updated_at
    `;
  }

  private async updateOrder(
    orderId: string,
    status: OrderStatus,
    fields: {
      checkoutSessionId?: string;
      paymentId?: string;
      fulfillmentJobId?: string;
      scribelessJobId?: string;
    },
  ) {
    const result = await this.databaseService.query<OrderRow>(
      `
        UPDATE orders
        SET
          status = $2,
          checkout_session_id = COALESCE($3, checkout_session_id),
          payment_id = COALESCE($4, payment_id),
          fulfillment_job_id = COALESCE($5, fulfillment_job_id),
          scribeless_job_id = COALESCE($6, scribeless_job_id),
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
      ],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    return result.rows[0];
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

  private async ensureSelectedAssetExists(userId: string, cardDraftId: string, selectedAssetId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id
        FROM assets
        WHERE id = $1
          AND user_id = $2
          AND card_draft_id = $3;
      `,
      [selectedAssetId, userId, cardDraftId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Selected asset not found for this draft.');
    }
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
