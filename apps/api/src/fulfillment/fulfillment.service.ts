import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { OrdersService } from '../orders/orders.service';
import { SubmitFulfillmentDto } from './fulfillment.controller';

type FulfillmentRow = {
  id: string;
  order_id: string;
  user_id: string;
  provider_mode: string;
  mock_fulfillment_id: string;
  status: string;
  submitted_at: Date | string;
  estimated_delivery: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ordersService: OrdersService,
  ) {}

  async submitFulfillment(dto: SubmitFulfillmentDto) {
    const order = await this.ordersService.findOrderRow(dto.orderId);
    this.ordersService.assertOrderStatus(
      order,
      ['paid_mock'],
      'submit fulfillment',
    );

    const mockFulfillmentId = `mock_fulfillment_${randomUUID()}`;
    const estimatedDelivery =
      dto.estimatedDelivery ?? 'Mock delivery estimate: 5-7 business days.';

    await this.ordersService.markFulfillmentStarted(order.id);

    // TODO(Phase 2): replace this mock record with a Scribeless fulfillment job.
    try {
      const fulfillmentResult = await this.databaseService.query<FulfillmentRow>(
        `
          INSERT INTO fulfillment_jobs (
            order_id,
            user_id,
            provider_mode,
            mock_fulfillment_id,
            status,
            estimated_delivery,
            request_payload,
            response_payload
          )
          VALUES ($1, $2, 'mock', $3, 'fulfilled_mock', $4, $5::jsonb, $6::jsonb)
          RETURNING
            id,
            order_id,
            user_id,
            provider_mode,
            mock_fulfillment_id,
            status,
            submitted_at,
            estimated_delivery,
            request_payload,
            response_payload,
            created_at,
            updated_at;
        `,
        [
          order.id,
          order.user_id,
          mockFulfillmentId,
          estimatedDelivery,
          JSON.stringify({
            orderId: order.id,
            cardDraftId: order.card_draft_id,
            selectedAssetId: order.selected_asset_id,
            recipientAddress: order.recipient_address ?? {},
            senderAddress: order.sender_address ?? {},
            qrCodeUrl: order.qr_code_url,
          }),
          JSON.stringify({
            mock: true,
            message: 'Mock fulfillment completed locally.',
          }),
        ],
      );

      const fulfillment = fulfillmentResult.rows[0];
      const updatedOrder = await this.ordersService.markFulfilledMock(
        order.id,
        fulfillment.id,
        mockFulfillmentId,
      );

      return {
        fulfillment: this.toFulfillmentResponse(fulfillment),
        order: this.ordersService.toOrderResponse(updatedOrder),
      };
    } catch {
      await this.ordersService.markFailedMock(order.id).catch(() => undefined);

      throw new BadRequestException(
        'Mock fulfillment failed. Order was marked failed_mock.',
      );
    }
  }

  async getFulfillmentByOrder(orderId: string) {
    const result = await this.databaseService.query<FulfillmentRow>(
      `
        SELECT
          id,
          order_id,
          user_id,
          provider_mode,
          mock_fulfillment_id,
          status,
          submitted_at,
          estimated_delivery,
          request_payload,
          response_payload,
          created_at,
          updated_at
        FROM fulfillment_jobs
        WHERE order_id = $1
        ORDER BY created_at DESC;
      `,
      [orderId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Fulfillment record not found.');
    }

    return {
      orderId,
      fulfillments: result.rows.map((row) => this.toFulfillmentResponse(row)),
    };
  }

  private toFulfillmentResponse(row: FulfillmentRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      providerMode: row.provider_mode,
      mockFulfillmentId: row.mock_fulfillment_id,
      status: row.status,
      submittedAt: this.toIso(row.submitted_at),
      estimatedDelivery: row.estimated_delivery,
      requestPayload: row.request_payload ?? {},
      responsePayload: row.response_payload ?? {},
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
