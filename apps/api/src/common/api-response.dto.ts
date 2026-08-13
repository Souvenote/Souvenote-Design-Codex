import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const dateTime = { type: 'string' as const, format: 'date-time' };
const nullableDateTime = { ...dateTime, nullable: true };

export class UserViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) firstName!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) lastName!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ type: 'string', format: 'date', nullable: true }) birthday!: string | null;
  @ApiProperty({ enum: ['CA'] }) country!: string;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty() language!: string;
  @ApiProperty() marketingOptIn!: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true }) preferences!: Record<string, unknown>;
  @ApiProperty(dateTime) provisionedAt!: string;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class MeResponseDto {
  @ApiProperty({ type: UserViewDto }) user!: UserViewDto;
}

export class CreditBalanceResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) balance!: number;
}

export class PricingOfferViewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'uuid' }) offerId!: string;
  @ApiProperty({ enum: ['try_risk_free', 'big_sender'] }) type!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) unitAmountMinor!: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, nullable: true }) authorizationAmountMinor!: number | null;
  @ApiPropertyOptional({ type: 'integer', minimum: 0, nullable: true }) noSendFeeMinor!: number | null;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) authorizationDays!: number | null;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ enum: ['CA'] }) marketCountry!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) minimumQuantity!: number;
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 30 }) maximumQuantity!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) creditsPerCard!: number;
  @ApiProperty() shippingIncluded!: boolean;
  @ApiProperty({ description: 'Always false until the separately approved checkout activation.' })
  checkoutEnabled!: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, unknown>;
}

export class PricingCatalogResponseDto {
  @ApiProperty({ type: [PricingOfferViewDto] }) data!: PricingOfferViewDto[];
  @ApiProperty({ type: () => [CreditPackOfferViewDto] }) creditPacks!: CreditPackOfferViewDto[];
}

export class CreditPackOfferViewDto {
  @ApiProperty({ enum: ['credit_pack_10', 'credit_pack_80', 'credit_pack_250'] }) id!: string;
  @ApiProperty({ format: 'uuid' }) offerId!: string;
  @ApiProperty({ type: 'integer', enum: [10, 80, 250] }) creditQuantity!: number;
  @ApiProperty({ type: 'integer', enum: [200, 1000, 2500] }) unitAmountMinor!: number;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ enum: ['CA'] }) marketCountry!: string;
  @ApiProperty({ description: 'False until Section 5 activates Stripe-hosted checkout.' })
  checkoutEnabled!: boolean;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, unknown>;
}

export class CreditPackPurchaseViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['credit_pack_10', 'credit_pack_80', 'credit_pack_250'] }) offerCode!: string;
  @ApiProperty({ enum: ['captured'] }) status!: string;
  @ApiProperty({ enum: ['mock'] }) provider!: string;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ type: 'integer', enum: [200, 1000, 2500] }) amountMinor!: number;
  @ApiProperty({ type: 'integer', enum: [10, 80, 250] }) creditsGranted!: number;
  @ApiProperty(dateTime) capturedAt!: string;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ enum: [true] }) mockMode!: true;
  @ApiProperty({ enum: [false] }) productionEnabled!: false;
}

export class CreditPackPurchaseResponseDto {
  @ApiProperty({ type: CreditPackPurchaseViewDto }) purchase!: CreditPackPurchaseViewDto;
}

export class CreditPackPurchaseStartResponseDto extends CreditPackPurchaseResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) balance!: number;
}

export class CardEntitlementViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() sourceType!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) quantityTotal!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) quantityReserved!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) quantityConsumed!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) quantityAvailable!: number;
  @ApiPropertyOptional(nullableDateTime) expiresAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CardEntitlementListResponseDto {
  @ApiProperty({ type: [CardEntitlementViewDto] }) data!: CardEntitlementViewDto[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class CardReservationViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) offerId!: string;
  @ApiProperty() offerCode!: string;
  @ApiProperty({ enum: ['reserved', 'released', 'converted', 'expired'] }) status!: string;
  @ApiProperty({ type: 'integer', minimum: 2, maximum: 30 }) quantity!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) unitAmountMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 1 }) totalAmountMinor!: number;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ enum: ['not_started'] }) paymentState!: string;
  @ApiProperty({ enum: [false] }) entitlementGranted!: false;
  @ApiProperty(dateTime) expiresAt!: string;
  @ApiPropertyOptional(nullableDateTime) releasedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CardReservationResponseDto {
  @ApiProperty({ type: CardReservationViewDto }) reservation!: CardReservationViewDto;
}

export class TryRiskFreeAuthorizationViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) entitlementId!: string | null;
  @ApiProperty({ enum: ['authorized', 'captured_full', 'captured_no_send', 'canceled'] }) status!: string;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ type: 'integer', enum: [999] }) authorizedAmountMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 999 }) capturedAmountMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 999 }) releasedAmountMinor!: number;
  @ApiProperty({ type: 'integer', enum: [10] }) creditsGranted!: number;
  @ApiProperty(dateTime) authorizedAt!: string;
  @ApiProperty(dateTime) authorizationExpiresAt!: string;
  @ApiPropertyOptional(nullableDateTime) fulfillmentStartedAt!: string | null;
  @ApiPropertyOptional(nullableDateTime) resolvedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
  @ApiProperty({ enum: [true] }) mockMode!: true;
  @ApiProperty({ enum: [false] }) productionEnabled!: false;
}

export class TryRiskFreeAuthorizationResponseDto {
  @ApiProperty({ type: TryRiskFreeAuthorizationViewDto }) authorization!: TryRiskFreeAuthorizationViewDto;
}

export class TryRiskFreeStartResponseDto extends TryRiskFreeAuthorizationResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) balance!: number;
}

export class CardDraftViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['personalize_template', 'build_my_card'] }) creationRoute!: string;
  @ApiProperty({ enum: ['draft', 'generating', 'review', 'approved', 'ordered', 'sent', 'archived'] }) status!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) occasion!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) relationship!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) creativeBrief!: Record<string, unknown>;
  @ApiProperty({ type: 'integer', minimum: 1 }) revisionNumber!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) approvedImageAssetId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) approvedSongAssetId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) approvedMessageAssetId!: string | null;
  @ApiPropertyOptional(nullableDateTime) approvedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CardDraftResponseDto {
  @ApiProperty({ type: CardDraftViewDto }) cardDraft!: CardDraftViewDto;
}

export class CardDraftListResponseDto {
  @ApiProperty({ type: [CardDraftViewDto] }) data!: CardDraftViewDto[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class UploadViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) cardDraftId!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) revisionId!: string | null;
  @ApiProperty() filename!: string;
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] }) mimeType!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) size!: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) widthPixels!: number | null;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) heightPixels!: number | null;
  @ApiProperty({
    enum: [
      'upload_pending',
      'upload_done',
      'moderation_pending',
      'moderation_passed',
      'moderation_failed',
      'attestation_required',
      'attestation_done',
      'committed',
    ],
  })
  status!: string;
  @ApiPropertyOptional(nullableDateTime) rightsAttestedAt!: string | null;
  @ApiPropertyOptional(nullableDateTime) committedAt!: string | null;
  @ApiProperty(dateTime) expiresAt!: string;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class UploadResponseDto {
  @ApiProperty({ type: UploadViewDto }) upload!: UploadViewDto;
}

export class GenerationJobViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) cardDraftId!: string;
  @ApiProperty({ format: 'uuid' }) revisionId!: string;
  @ApiProperty({
    enum: ['queued', 'running', 'succeeded', 'partially_failed', 'failed', 'refunded', 'canceled', 'approved'],
  })
  status!: string;
  @ApiProperty({
    enum: ['initial_image', 'initial_image_song', 'regenerate_image', 'regenerate_song', 'inside_message'],
  })
  actionType!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) creditsReserved!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) creditsRefunded!: number;
  @ApiPropertyOptional(nullableDateTime) approvedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class GenerationResponseDto {
  @ApiProperty({ type: GenerationJobViewDto }) generationJob!: GenerationJobViewDto;
}

export class GenerationStartResponseDto extends GenerationResponseDto {
  @ApiProperty({ type: 'integer', minimum: 0 }) balance!: number;
}

export class GenerationListResponseDto {
  @ApiProperty({ type: [GenerationJobViewDto] }) data!: GenerationJobViewDto[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class AssetViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) cardDraftId!: string;
  @ApiProperty({ format: 'uuid' }) revisionId!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) generationJobId!: string | null;
  @ApiProperty({ enum: ['upload', 'image', 'song', 'message', 'qr', 'print'] }) assetType!: string;
  @ApiProperty({ enum: ['pending', 'generating', 'ready', 'failed'] }) generationStatus!: string;
  @ApiProperty() mediaType!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) byteSize!: number;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) widthPixels!: number | null;
  @ApiPropertyOptional({ type: 'integer', minimum: 1, nullable: true }) heightPixels!: number | null;
  @ApiPropertyOptional({ type: 'number', minimum: 0, nullable: true }) durationSeconds!: number | null;
  @ApiProperty({ enum: ['pending', 'passed', 'failed', 'not_required'] }) moderationStatus!: string;
  @ApiPropertyOptional(nullableDateTime) approvedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class AssetResponseDto {
  @ApiProperty({ type: AssetViewDto }) asset!: AssetViewDto;
}

export class AssetListResponseDto {
  @ApiProperty({ type: [AssetViewDto] }) data!: AssetViewDto[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class OrderViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: ['CAD'] }) currency!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) subtotalMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) shippingMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) taxMinor!: number;
  @ApiProperty({ type: 'integer', minimum: 0 }) totalMinor!: number;
  @ApiPropertyOptional({ type: 'object', nullable: true, additionalProperties: true }) recipientAddress!: Record<
    string,
    unknown
  > | null;
  @ApiPropertyOptional({ type: 'object', nullable: true, additionalProperties: true }) senderAddress!: Record<
    string,
    unknown
  > | null;
  @ApiPropertyOptional(nullableDateTime) placedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class OrderResponseDto {
  @ApiProperty({ type: OrderViewDto }) order!: OrderViewDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderViewDto] }) data!: OrderViewDto[];
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class FulfillmentJobViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: 'integer', minimum: 0 }) attemptCount!: number;
  @ApiPropertyOptional(nullableDateTime) submittedAt!: string | null;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class FulfillmentJobResponseDto {
  @ApiProperty({ type: FulfillmentJobViewDto }) fulfillmentJob!: FulfillmentJobViewDto;
}

export class PublicSongViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['pending', 'generating', 'ready', 'failed'] }) status!: string;
  @ApiPropertyOptional({ type: 'number', minimum: 0, nullable: true }) durationSeconds!: number | null;
}

export class PublicCardViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() publicPath!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) qrPayloadVersion!: number;
  @ApiPropertyOptional(nullableDateTime) expiresAt!: string | null;
  @ApiPropertyOptional({ type: PublicSongViewDto, nullable: true }) song!: PublicSongViewDto | null;
}

export class PublicCardResponseDto {
  @ApiProperty({ type: PublicCardViewDto }) card!: PublicCardViewDto;
}

export class WebhookReceiptResponseDto {
  @ApiProperty({ enum: [true] }) received!: true;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] }) status!: string;
  @ApiProperty({ enum: ['souvenote-backend'] }) service!: string;
  @ApiProperty(dateTime) timestamp!: string;
  @ApiPropertyOptional({ enum: ['connected'] }) database?: string;
}
