import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardEntitlementsService } from '../card-entitlements/card-entitlements.service';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { type OrderRow, OrdersService } from '../orders/orders.service';
import { PublicCardLinksService } from '../public-card-links/public-card-links.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { FulfillmentProviderRegistry } from './fulfillment-provider.registry';
import {
  FulfillmentSubmissionError,
  type FulfillmentPostalAddress,
  type FulfillmentProvider,
  type FulfillmentProviderRequest,
} from './fulfillment.provider';
import { SubmitFulfillmentDto } from './fulfillment.controller';

type FulfillmentStatus =
  | 'creating'
  | 'submitting'
  | 'submitted'
  | 'printing'
  | 'shipped'
  | 'delivered'
  | 'on_hold'
  | 'failed'
  | 'submission_unknown'
  | 'fulfilled_mock';

type FulfillmentRow = {
  id: string;
  order_id: string;
  user_id: string;
  provider_mode: string;
  mock_fulfillment_id: string | null;
  provider_fulfillment_id: string | null;
  provider_recipient_ids: unknown;
  provider_campaign_id: string | null;
  provider_status: string | null;
  status: FulfillmentStatus;
  attempt_number: number;
  idempotency_key: string;
  submitted_at: Date | string | null;
  estimated_delivery: string | null;
  status_reason: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  last_synced_at: Date | string | null;
  completed_at: Date | string | null;
  failed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type FulfillmentAssetRow = {
  id: string;
  asset_type: string;
  s3_key: string | null;
  qr_metadata: Record<string, unknown> | null;
  approved_at: Date | string | null;
  moderation_state: string | null;
};

type PreparedSubmission = {
  order: OrderRow;
  fulfillment: FulfillmentRow;
  idempotentReplay: boolean;
};

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ordersService: OrdersService,
    private readonly providerRegistry: FulfillmentProviderRegistry,
    private readonly uploadStorageService: UploadStorageService,
    private readonly configService: ConfigService,
    private readonly publicCardLinksService: PublicCardLinksService,
    private readonly notificationsService: NotificationsService,
    private readonly cardEntitlementsService: CardEntitlementsService,
    @Optional()
    private readonly referralsService?: ReferralsService,
  ) {}

  async submitFulfillment(userId: string, dto: SubmitFulfillmentDto) {
    const provider = this.providerRegistry.getActiveProvider();
    const prepared = await this.prepareSubmission(
      userId,
      dto.orderId,
      provider,
    );
    if (prepared.idempotentReplay) {
      return this.buildResponse(prepared.fulfillment, prepared.order, true);
    }

    try {
      const providerRequest = await this.buildProviderRequest(
        prepared.order,
        prepared.fulfillment,
        provider,
      );
      await this.markSubmitting(prepared.fulfillment.id, providerRequest);
      const providerResult = await provider.submit(providerRequest);
      try {
        return await this.completeSubmission(
          prepared.order,
          prepared.fulfillment,
          providerResult,
        );
      } catch (error) {
        if (error instanceof FulfillmentSubmissionError) throw error;
        throw new FulfillmentSubmissionError(
          `Fulfillment was accepted but local reconciliation failed: ${this.errorMessage(error)}`,
          true,
        );
      }
    } catch (error) {
      await this.failSubmission(prepared, error);
      if (error instanceof FulfillmentSubmissionError) {
        throw new BadGatewayException(error.message);
      }
      throw error;
    }
  }

  async getFulfillmentByOrder(userId: string, orderId: string) {
    await this.ordersService.findOrderRow(orderId, userId);
    const result = await this.databaseService.query<FulfillmentRow>(
      `
        SELECT ${this.fulfillmentColumns}
        FROM fulfillment_jobs
        WHERE order_id = $1
          AND user_id = $2
        ORDER BY attempt_number DESC;
      `,
      [orderId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Fulfillment record not found.');
    }
    return {
      orderId,
      fulfillments: result.rows.map((row) => this.toFulfillmentResponse(row)),
    };
  }

  async refreshFulfillmentByOrder(userId: string, orderId: string) {
    const order = await this.ordersService.findOrderRow(orderId, userId);
    const result = await this.databaseService.query<FulfillmentRow>(
      `
        SELECT ${this.fulfillmentColumns}
        FROM fulfillment_jobs
        WHERE order_id = $1
          AND user_id = $2
        ORDER BY attempt_number DESC
        LIMIT 1;
      `,
      [orderId, userId],
    );
    const fulfillment = result.rows[0];
    if (!fulfillment) {
      throw new NotFoundException('Fulfillment record not found.');
    }
    if (fulfillment.provider_mode === 'mock') {
      if (
        !fulfillment.provider_fulfillment_id &&
        ['creating', 'submitting'].includes(fulfillment.status)
      ) {
        return this.submitFulfillment(userId, { orderId });
      }
      return this.buildResponse(fulfillment, order, true);
    }
    if (
      ['creating', 'submitting', 'submission_unknown', 'failed'].includes(
        fulfillment.status,
      )
    ) {
      return this.buildResponse(fulfillment, order, true);
    }

    const recipientIds = this.recipientIds(fulfillment.provider_recipient_ids);
    const provider = this.providerRegistry.getProvider(
      fulfillment.provider_mode,
    );
    const providerResult = await provider.fetchStatus(recipientIds);
    return this.reconcileStatus(order, fulfillment, providerResult);
  }

  private async prepareSubmission(
    userId: string,
    orderId: string,
    provider: FulfillmentProvider,
  ): Promise<PreparedSubmission> {
    return this.databaseService.withTransaction(async (transaction) => {
      const order = await this.ordersService.findOrderRowForUpdate(
        transaction,
        orderId,
        userId,
      );
      const latestResult = await transaction.query<FulfillmentRow>(
        `
          SELECT ${this.fulfillmentColumns}
          FROM fulfillment_jobs
          WHERE order_id = $1
          ORDER BY attempt_number DESC
          LIMIT 1
          FOR UPDATE;
        `,
        [order.id],
      );
      const latest = latestResult.rows[0];
      if (latest && latest.status !== 'failed') {
        if (latest.status === 'submission_unknown') {
          throw new ConflictException(
            'The prior Scribeless submission outcome is unknown. Reconcile it with Scribeless before retrying to avoid duplicate physical mail.',
          );
        }
        const interruptedMockSubmission =
          provider.mode === 'mock' &&
          latest.provider_mode === 'mock' &&
          !latest.provider_fulfillment_id &&
          ['creating', 'submitting'].includes(latest.status);
        return {
          order,
          fulfillment: latest,
          idempotentReplay: !interruptedMockSubmission,
        };
      }

      const allowedStatuses =
        provider.mode === 'scribeless'
          ? (['paid', 'fulfillment_failed'] as const)
          : ([
              'paid',
              'paid_mock',
              'failed_mock',
              'fulfillment_failed',
            ] as const);
      this.ordersService.assertOrderStatus(
        order,
        [...allowedStatuses],
        'submit fulfillment',
      );

      const attemptResult = await transaction.query<{ attempt_number: number }>(
        `
          SELECT COALESCE(MAX(attempt_number), 0) + 1 AS attempt_number
          FROM fulfillment_jobs
          WHERE order_id = $1;
        `,
        [order.id],
      );
      const attemptNumber = Number(attemptResult.rows[0]?.attempt_number ?? 1);
      const idempotencyKey = `fulfillment:${order.id}:${provider.mode}:attempt:${attemptNumber}`;
      const inserted = await transaction.query<FulfillmentRow>(
        `
          INSERT INTO fulfillment_jobs (
            order_id,
            user_id,
            provider_mode,
            status,
            attempt_number,
            idempotency_key,
            request_payload,
            response_payload
          )
          VALUES ($1, $2, $3, 'creating', $4, $5, '{}'::jsonb, '{}'::jsonb)
          RETURNING ${this.fulfillmentColumns};
        `,
        [order.id, order.user_id, provider.mode, attemptNumber, idempotencyKey],
      );
      const fulfillment = inserted.rows[0];
      const prepaidReservationIsActive =
        order.funding_source === 'card_bank' &&
        !order.card_entitlements_released_at;
      if (!prepaidReservationIsActive) {
        await this.cardEntitlementsService.deductInTransaction(
          transaction,
          order.user_id,
          order.quantity,
          `order:${order.id}`,
          `fulfillment:${fulfillment.id}:deduct`,
        );
        if (order.funding_source === 'card_bank') {
          await this.ordersService.markCardEntitlementsReserved(
            order.id,
            transaction,
          );
        }
      }
      const updatedOrder = await this.ordersService.markFulfillmentStarted(
        order.id,
        transaction,
      );
      await this.writeAudit(
        transaction,
        order.user_id,
        'fulfillment_attempt_created',
        order.id,
        {
          fulfillmentJobId: fulfillment.id,
          providerMode: provider.mode,
          attemptNumber,
        },
      );
      return {
        order: updatedOrder,
        fulfillment,
        idempotentReplay: false,
      };
    });
  }

  private async buildProviderRequest(
    order: OrderRow,
    fulfillment: FulfillmentRow,
    provider: FulfillmentProvider,
  ): Promise<FulfillmentProviderRequest> {
    const addresses = Array.isArray(order.recipient_addresses)
      ? order.recipient_addresses
      : [];
    if (addresses.length !== order.quantity) {
      throw new BadRequestException(
        'The frozen recipient count does not match the paid order quantity.',
      );
    }
    const recipients = addresses.map((address, index) => ({
      externalId: `${order.id}:${index + 1}`,
      address: this.parseAddress(address, `recipient ${index + 1}`),
    }));
    const senderAddress = this.parseAddress(order.sender_address, 'sender');
    const assets = await this.loadApprovedAssets(order);
    const image = assets.find((asset) => asset.asset_type === 'image');
    const message = assets.find((asset) => asset.asset_type === 'message');
    const song = assets.find((asset) => asset.asset_type === 'song');
    const unapproved = assets.filter(
      (asset) =>
        !asset.approved_at ||
        !['approved', 'approved_mock'].includes(asset.moderation_state ?? ''),
    );
    if (unapproved.length) {
      throw new BadRequestException(
        'Every generated image, message, and optional song must be moderation-cleared and approved before fulfillment.',
      );
    }
    if (!image?.s3_key || !message) {
      throw new BadRequestException(
        'The approved card image and inside message are required for fulfillment.',
      );
    }
    const insideMessage =
      typeof message.qr_metadata?.text === 'string'
        ? message.qr_metadata.text.trim()
        : '';
    if (!insideMessage || insideMessage.length > 5000) {
      throw new BadRequestException(
        'The approved inside message is missing or too long for fulfillment.',
      );
    }

    let frontImageUrl: string | null = null;
    if (provider.mode === 'scribeless') {
      if (image.s3_key.startsWith('mock/')) {
        throw new BadRequestException(
          'Real fulfillment requires the approved card image in private S3.',
        );
      }
      frontImageUrl = await this.uploadStorageService.createReadUrl(
        image.s3_key,
        {
          expiresInSetting: 'SCRIBELESS_ASSET_URL_EXPIRES_SECONDS',
          defaultExpiresIn: 3600,
        },
      );
      if (!frontImageUrl) {
        throw new BadRequestException(
          'The approved card image could not be signed for Scribeless.',
        );
      }
    }

    const qrCodeUrl = song
      ? await this.resolveQrCodeUrl(order, provider)
      : null;
    return {
      localFulfillmentId: fulfillment.id,
      orderId: order.id,
      userId: order.user_id,
      recipients,
      senderAddress,
      frontImageUrl,
      insideMessage,
      qrCodeUrl,
    };
  }

  private async loadApprovedAssets(order: OrderRow) {
    if (!order.selected_asset_id) {
      throw new BadRequestException('Order has no selected card image.');
    }
    const result = await this.databaseService.query<FulfillmentAssetRow>(
      `
        WITH selected AS (
          SELECT generation_job_id
          FROM assets
          WHERE id = $1
            AND user_id = $2
            AND card_draft_id = $3
            AND asset_type = 'image'
        )
        SELECT
          asset.id,
          asset.asset_type,
          asset.s3_key,
          asset.qr_metadata,
          asset.approved_at,
          asset.moderation_state
        FROM assets asset
        INNER JOIN selected
          ON selected.generation_job_id = asset.generation_job_id
        WHERE asset.user_id = $2
          AND asset.card_draft_id = $3
          AND asset.asset_type IN ('image', 'song', 'message')
          AND (
            asset.asset_type <> 'image'
            OR asset.id = $1
          )
        ORDER BY asset.created_at ASC;
      `,
      [order.selected_asset_id, order.user_id, order.card_draft_id],
    );
    return result.rows;
  }

  private async markSubmitting(
    fulfillmentId: string,
    request: FulfillmentProviderRequest,
  ) {
    await this.databaseService.query(
      `
        UPDATE fulfillment_jobs
        SET
          status = 'submitting',
          request_payload = $2::jsonb,
          updated_at = NOW()
        WHERE id = $1
          AND status = 'creating';
      `,
      [
        fulfillmentId,
        JSON.stringify({
          orderId: request.orderId,
          recipientCount: request.recipients.length,
          recipientExternalIds: request.recipients.map(
            (recipient) => recipient.externalId,
          ),
          senderAddressConfirmed: true,
          hasFrontImage: Boolean(request.frontImageUrl),
          hasInsideMessage: Boolean(request.insideMessage),
          hasQrCode: Boolean(request.qrCodeUrl),
        }),
      ],
    );
  }

  private async completeSubmission(
    order: OrderRow,
    fulfillment: FulfillmentRow,
    providerResult: {
      providerFulfillmentId: string;
      providerRecipientIds: string[];
      providerCampaignId: string | null;
      providerStatus: string;
      estimatedDelivery: string | null;
      responseMetadata: Record<string, unknown>;
    },
  ) {
    if (
      !providerResult.providerFulfillmentId ||
      providerResult.providerRecipientIds.length !== order.quantity ||
      new Set(providerResult.providerRecipientIds).size !== order.quantity
    ) {
      throw new FulfillmentSubmissionError(
        'Fulfillment provider accepted the request but returned invalid recipient identifiers.',
        true,
      );
    }
    const status = this.mapProviderStatus(
      fulfillment.provider_mode,
      providerResult.providerStatus,
    );
    return this.databaseService.withTransaction(async (transaction) => {
      const current = await this.findFulfillmentForUpdate(
        transaction,
        fulfillment.id,
      );
      if (!['creating', 'submitting'].includes(current.status)) {
        const currentOrder = await this.ordersService.findOrderRowForUpdate(
          transaction,
          order.id,
          order.user_id,
        );
        return this.buildResponse(current, currentOrder, true);
      }
      const updated = await transaction.query<FulfillmentRow>(
        `
          UPDATE fulfillment_jobs
          SET
            mock_fulfillment_id = CASE WHEN provider_mode = 'mock' THEN $2 ELSE NULL END,
            provider_fulfillment_id = $2,
            provider_recipient_ids = $3::jsonb,
            provider_campaign_id = $4,
            provider_status = $5,
            status = $6::text,
            submitted_at = NOW(),
            estimated_delivery = $7,
            response_payload = $8::jsonb,
            last_synced_at = NOW(),
            completed_at = CASE
              WHEN $6::text IN ('delivered', 'fulfilled_mock') THEN NOW()
              ELSE completed_at
            END,
            status_reason = NULL,
            updated_at = NOW()
          WHERE id = $1
          RETURNING ${this.fulfillmentColumns};
        `,
        [
          fulfillment.id,
          providerResult.providerFulfillmentId,
          JSON.stringify(providerResult.providerRecipientIds),
          providerResult.providerCampaignId,
          providerResult.providerStatus,
          status,
          providerResult.estimatedDelivery,
          JSON.stringify(providerResult.responseMetadata),
        ],
      );
      const updatedFulfillment = updated.rows[0];
      if (updatedFulfillment.status === 'failed') {
        await this.refundFulfillmentEntitlements(
          transaction,
          order,
          updatedFulfillment,
        );
      }
      const updatedOrder = await this.applyOrderStatus(
        transaction,
        order,
        updatedFulfillment,
      );
      await this.writeAudit(
        transaction,
        order.user_id,
        'fulfillment_submitted',
        order.id,
        {
          fulfillmentJobId: fulfillment.id,
          providerMode: fulfillment.provider_mode,
          providerStatus: providerResult.providerStatus,
          recipientCount: providerResult.providerRecipientIds.length,
        },
      );
      await this.enqueueFulfillmentNotification(
        transaction,
        updatedOrder,
        updatedFulfillment.status,
      );
      if (
        this.referralsService &&
        [
          'submitted',
          'printing',
          'shipped',
          'delivered',
          'fulfilled_mock',
        ].includes(updatedFulfillment.status)
      ) {
        await this.referralsService.rewardReferrerForFirstSend(
          transaction,
          order.user_id,
          order.id,
        );
      }
      return this.buildResponse(updatedFulfillment, updatedOrder, false);
    });
  }

  private async failSubmission(prepared: PreparedSubmission, error: unknown) {
    const outcomeUnknown =
      error instanceof FulfillmentSubmissionError && error.outcomeUnknown;
    const status: FulfillmentStatus = outcomeUnknown
      ? 'submission_unknown'
      : 'failed';
    const reason = this.errorMessage(error);
    await this.databaseService.withTransaction(async (transaction) => {
      const updated = await transaction.query<FulfillmentRow>(
        `
          UPDATE fulfillment_jobs
          SET
            status = $2::text,
            status_reason = $3,
            failed_at = CASE
              WHEN $2::text = 'failed' THEN NOW()
              ELSE failed_at
            END,
            last_synced_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND status IN ('creating', 'submitting')
          RETURNING ${this.fulfillmentColumns};
        `,
        [prepared.fulfillment.id, status, reason],
      );
      if (!updated.rows[0]) return;
      if (!outcomeUnknown) {
        await this.refundFulfillmentEntitlements(
          transaction,
          prepared.order,
          updated.rows[0],
        );
      }
      await this.ordersService.markFulfillmentState(
        prepared.order.id,
        outcomeUnknown ? 'fulfillment_on_hold' : 'fulfillment_failed',
        { fulfillmentJobId: prepared.fulfillment.id },
        transaction,
      );
      await this.writeAudit(
        transaction,
        prepared.order.user_id,
        outcomeUnknown
          ? 'fulfillment_submission_unknown'
          : 'fulfillment_submission_failed',
        prepared.order.id,
        {
          fulfillmentJobId: prepared.fulfillment.id,
          providerMode: prepared.fulfillment.provider_mode,
          reason,
        },
      );
    });
  }

  private async reconcileStatus(
    order: OrderRow,
    fulfillment: FulfillmentRow,
    providerResult: {
      providerStatus: string;
      recipientStatuses: Array<{
        id: string;
        status: string;
        isRendered: boolean | null;
      }>;
      responseMetadata: Record<string, unknown>;
    },
  ) {
    const proposed = this.mapProviderStatus(
      fulfillment.provider_mode,
      providerResult.providerStatus,
    );
    const nextStatus = this.monotonicStatus(fulfillment.status, proposed);
    return this.databaseService.withTransaction(async (transaction) => {
      const current = await this.findFulfillmentForUpdate(
        transaction,
        fulfillment.id,
      );
      const currentOrder = await this.ordersService.findOrderRowForUpdate(
        transaction,
        order.id,
        order.user_id,
      );
      const appliedStatus = this.monotonicStatus(current.status, nextStatus);
      const updated = await transaction.query<FulfillmentRow>(
        `
          UPDATE fulfillment_jobs
          SET
            provider_status = $2,
            status = $3::text,
            response_payload = response_payload || $4::jsonb,
            last_synced_at = NOW(),
            completed_at = CASE
              WHEN $3::text = 'delivered' THEN COALESCE(completed_at, NOW())
              ELSE completed_at
            END,
            status_reason = CASE
              WHEN $3::text = 'on_hold' THEN 'Scribeless placed one or more recipients on hold.'
              WHEN $3::text = 'failed' THEN 'Scribeless marked one or more recipients as not sent.'
              ELSE NULL
            END,
            updated_at = NOW()
          WHERE id = $1
          RETURNING ${this.fulfillmentColumns};
        `,
        [
          current.id,
          providerResult.providerStatus,
          appliedStatus,
          JSON.stringify({
            ...providerResult.responseMetadata,
            recipientStatuses: providerResult.recipientStatuses,
          }),
        ],
      );
      const updatedFulfillment = updated.rows[0];
      if (appliedStatus === 'failed') {
        await this.refundFulfillmentEntitlements(
          transaction,
          currentOrder,
          updatedFulfillment,
        );
      }
      const updatedOrder = await this.applyOrderStatus(
        transaction,
        currentOrder,
        updatedFulfillment,
      );
      if (appliedStatus !== current.status) {
        await this.writeAudit(
          transaction,
          order.user_id,
          'fulfillment_status_reconciled',
          order.id,
          {
            fulfillmentJobId: current.id,
            previousStatus: current.status,
            status: appliedStatus,
            providerStatus: providerResult.providerStatus,
          },
        );
        await this.enqueueFulfillmentNotification(
          transaction,
          updatedOrder,
          appliedStatus,
        );
      }
      return this.buildResponse(updatedFulfillment, updatedOrder, true);
    });
  }

  private async refundFulfillmentEntitlements(
    transaction: DatabaseTransaction,
    order: Pick<OrderRow, 'id' | 'user_id' | 'quantity' | 'funding_source'>,
    fulfillment: Pick<FulfillmentRow, 'id'>,
  ) {
    const refund = await this.cardEntitlementsService.refundOnceInTransaction(
      transaction,
      order.user_id,
      order.quantity,
      `order:${order.id}`,
      `fulfillment:${fulfillment.id}:refund`,
    );
    if (order.funding_source === 'card_bank') {
      await this.ordersService.markCardEntitlementsReleased(
        order.id,
        transaction,
      );
    }
    return refund;
  }

  private async applyOrderStatus(
    transaction: DatabaseTransaction,
    order: OrderRow,
    fulfillment: FulfillmentRow,
  ) {
    const providerId = fulfillment.provider_fulfillment_id ?? undefined;
    if (fulfillment.status === 'fulfilled_mock' && providerId) {
      return this.ordersService.markFulfilledMock(
        order.id,
        fulfillment.id,
        providerId,
        transaction,
      );
    }
    const orderStatus = {
      submitted: 'fulfillment_submitted',
      printing: 'printing',
      shipped: 'shipped',
      delivered: 'delivered',
      on_hold: 'fulfillment_on_hold',
      failed: 'fulfillment_failed',
    }[fulfillment.status] as
      | 'fulfillment_submitted'
      | 'printing'
      | 'shipped'
      | 'delivered'
      | 'fulfillment_on_hold'
      | 'fulfillment_failed'
      | undefined;
    if (!orderStatus) return order;
    return this.ordersService.markFulfillmentState(
      order.id,
      orderStatus,
      {
        fulfillmentJobId: fulfillment.id,
        scribelessJobId: providerId,
      },
      transaction,
    );
  }

  private mapProviderStatus(
    providerMode: string,
    providerStatus: string,
  ): FulfillmentStatus {
    if (providerMode === 'mock') return 'fulfilled_mock';
    const status = providerStatus
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (['pending', 'ready'].includes(status)) return 'submitted';
    if (['in_progress', 'printing', 'ready_to_ship'].includes(status)) {
      return 'printing';
    }
    if (status === 'shipped') return 'shipped';
    if (status === 'delivered') return 'delivered';
    if (['hold', 'admin_hold', 'paused'].includes(status)) return 'on_hold';
    if (['not_sent', 'ignored', 'deleted', 'failed'].includes(status)) {
      return 'failed';
    }
    return 'on_hold';
  }

  private async enqueueFulfillmentNotification(
    transaction: DatabaseTransaction,
    order: OrderRow,
    fulfillmentStatus: FulfillmentStatus,
  ) {
    const eventType = {
      shipped: 'order_shipped',
      delivered: 'order_delivered',
    }[fulfillmentStatus] as 'order_shipped' | 'order_delivered' | undefined;
    if (!eventType) return;
    await this.notificationsService.enqueueOrderNotification(transaction, {
      eventType,
      userId: order.user_id,
      orderId: order.id,
      orderStatus: eventType === 'order_shipped' ? 'shipped' : 'delivered',
      quantity: order.quantity,
      amountCents: order.amount_cents,
      currency: order.currency,
    });
  }

  private monotonicStatus(
    current: FulfillmentStatus,
    proposed: FulfillmentStatus,
  ): FulfillmentStatus {
    if (current === 'fulfilled_mock' || current === 'delivered') return current;
    const rank: Partial<Record<FulfillmentStatus, number>> = {
      creating: 0,
      submitting: 0,
      submitted: 1,
      printing: 2,
      shipped: 3,
      delivered: 4,
    };
    if (current === 'shipped' && ['on_hold', 'failed'].includes(proposed)) {
      return current;
    }
    if (proposed === 'on_hold' || proposed === 'failed') return proposed;
    if (current === 'on_hold' || current === 'failed') return proposed;
    const currentRank = rank[current] ?? 0;
    const proposedRank = rank[proposed] ?? 0;
    return proposedRank >= currentRank ? proposed : current;
  }

  private parseAddress(
    value: Record<string, unknown> | null,
    label: string,
  ): FulfillmentPostalAddress {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`The ${label} address is missing.`);
    }
    const name = this.addressField(value, 'name', label, 1, 160);
    const nameParts = name.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      throw new BadRequestException(
        `The ${label} address must include first and last name.`,
      );
    }
    const country = this.addressField(
      value,
      'country',
      label,
      2,
      2,
    ).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException(
        `The ${label} country must be a two-letter code.`,
      );
    }
    const line2 = this.optionalAddressField(value, 'line2', label, 160);
    return {
      firstName: nameParts.shift() ?? '',
      lastName: nameParts.join(' '),
      address1: this.addressField(value, 'line1', label, 1, 160),
      ...(line2 ? { address2: line2 } : {}),
      city: this.addressField(value, 'city', label, 1, 100),
      state: this.addressField(value, 'region', label, 1, 100),
      postalCode: this.addressField(value, 'postalCode', label, 1, 32),
      country,
    };
  }

  private addressField(
    address: Record<string, unknown>,
    key: string,
    label: string,
    minimum: number,
    maximum: number,
  ) {
    const value = typeof address[key] === 'string' ? address[key].trim() : '';
    if (value.length < minimum || value.length > maximum) {
      throw new BadRequestException(
        `The ${label} address field ${key} is invalid.`,
      );
    }
    return value;
  }

  private optionalAddressField(
    address: Record<string, unknown>,
    key: string,
    label: string,
    maximum: number,
  ) {
    if (address[key] === undefined || address[key] === null) return '';
    return this.addressField(address, key, label, 0, maximum);
  }

  private async resolveQrCodeUrl(
    order: OrderRow,
    provider: FulfillmentProvider,
  ) {
    if (provider.mode === 'mock') return order.qr_code_url;
    const template = this.configService
      .get<string>('SCRIBELESS_QR_DESTINATION_URL')
      ?.trim();
    if (!template || !template.includes('{PUBLIC_TOKEN}')) {
      throw new BadRequestException(
        'SCRIBELESS_QR_DESTINATION_URL with {PUBLIC_TOKEN} is required for cards that include a song.',
      );
    }
    const token = await this.publicCardLinksService.getOrCreateToken(order.id);
    let url: URL;
    try {
      url = new URL(
        template.replace('{PUBLIC_TOKEN}', encodeURIComponent(token)),
      );
    } catch {
      throw new BadRequestException(
        'SCRIBELESS_QR_DESTINATION_URL is invalid.',
      );
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.toString().length > 500
    ) {
      throw new BadRequestException(
        'SCRIBELESS_QR_DESTINATION_URL must resolve to a safe HTTPS URL.',
      );
    }
    return url.toString();
  }

  private async findFulfillmentForUpdate(
    transaction: DatabaseTransaction,
    fulfillmentId: string,
  ) {
    const result = await transaction.query<FulfillmentRow>(
      `
        SELECT ${this.fulfillmentColumns}
        FROM fulfillment_jobs
        WHERE id = $1
        FOR UPDATE;
      `,
      [fulfillmentId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Fulfillment record not found.');
    }
    return result.rows[0];
  }

  private recipientIds(value: unknown) {
    if (
      !Array.isArray(value) ||
      !value.length ||
      value.some((id) => typeof id !== 'string' || !id.trim())
    ) {
      throw new ConflictException(
        'Fulfillment recipient identifiers are incomplete and cannot be polled safely.',
      );
    }
    return value.map((id) => String(id));
  }

  private buildResponse(
    fulfillment: FulfillmentRow,
    order: OrderRow,
    idempotentReplay: boolean,
  ) {
    return {
      fulfillment: this.toFulfillmentResponse(fulfillment),
      order: this.ordersService.toOrderResponse(order),
      idempotentReplay,
    };
  }

  private toFulfillmentResponse(row: FulfillmentRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      providerMode: row.provider_mode,
      mockFulfillmentId: row.mock_fulfillment_id,
      providerFulfillmentId: row.provider_fulfillment_id,
      providerRecipientIds: this.safeRecipientIds(row.provider_recipient_ids),
      providerCampaignId: row.provider_campaign_id,
      providerStatus: row.provider_status,
      status: row.status,
      attemptNumber: row.attempt_number,
      idempotencyKey: row.idempotency_key,
      submittedAt: this.toIso(row.submitted_at),
      estimatedDelivery: row.estimated_delivery,
      statusReason: row.status_reason,
      requestPayload: row.request_payload ?? {},
      responsePayload: row.response_payload ?? {},
      lastSyncedAt: this.toIso(row.last_synced_at),
      completedAt: this.toIso(row.completed_at),
      failedAt: this.toIso(row.failed_at),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private safeRecipientIds(value: unknown) {
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [];
  }

  private async writeAudit(
    transaction: DatabaseTransaction,
    userId: string,
    action: string,
    orderId: string,
    metadata: Record<string, unknown>,
  ) {
    await transaction.query(
      `
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, 'order', $3, $4::jsonb);
      `,
      [userId, action, orderId, JSON.stringify(metadata)],
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error
      ? error.message.slice(0, 1000)
      : 'Unknown fulfillment failure';
  }

  private toIso(value: Date | string | null) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  private get fulfillmentColumns() {
    return `
      id,
      order_id,
      user_id,
      provider_mode,
      mock_fulfillment_id,
      provider_fulfillment_id,
      provider_recipient_ids,
      provider_campaign_id,
      provider_status,
      status,
      attempt_number,
      idempotency_key,
      submitted_at,
      estimated_delivery,
      status_reason,
      request_payload,
      response_payload,
      last_synced_at,
      completed_at,
      failed_at,
      created_at,
      updated_at
    `;
  }
}
