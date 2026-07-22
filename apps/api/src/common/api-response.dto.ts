import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const dateTime = { type: 'string' as const, format: 'date-time' };
const nullableDateTime = { ...dateTime, nullable: true };

export class UserViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiPropertyOptional({ nullable: true }) firstName!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastName!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
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
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, unknown>;
}

export class PricingCatalogResponseDto {
  @ApiProperty({ type: [PricingOfferViewDto] }) data!: PricingOfferViewDto[];
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
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class CardDraftViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['personalize_template', 'build_my_card'] }) creationRoute!: string;
  @ApiProperty({ enum: ['draft', 'generating', 'review', 'approved', 'ordered', 'sent', 'archived'] }) status!: string;
  @ApiPropertyOptional({ nullable: true }) occasion!: string | null;
  @ApiPropertyOptional({ nullable: true }) relationship!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) creativeBrief!: Record<string, unknown>;
  @ApiProperty({ type: 'integer', minimum: 1 }) revisionNumber!: number;
  @ApiProperty(dateTime) createdAt!: string;
  @ApiProperty(dateTime) updatedAt!: string;
}

export class CardDraftResponseDto {
  @ApiProperty({ type: CardDraftViewDto }) cardDraft!: CardDraftViewDto;
}

export class CardDraftListResponseDto {
  @ApiProperty({ type: [CardDraftViewDto] }) data!: CardDraftViewDto[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class UploadViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) cardDraftId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) revisionId!: string | null;
  @ApiProperty() filename!: string;
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] }) mimeType!: string;
  @ApiProperty({ type: 'integer', minimum: 1 }) size!: number;
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
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor!: string | null;
}

export class AssetViewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) cardDraftId!: string;
  @ApiProperty({ format: 'uuid' }) revisionId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) generationJobId!: string | null;
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
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor!: string | null;
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
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor!: string | null;
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
