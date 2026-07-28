import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { MockUploadDto } from './upload.controller';
import {
  UploadStorageService,
  type UploadProviderMode,
} from './upload-storage.service';
import {
  enqueuePendingModerationJob,
  resolveModerationProviderMode,
} from '../moderation/moderation-queue';

type UploadRow = {
  id: string;
  user_id: string;
  card_draft_id: string;
  asset_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  mock_url: string | null;
  provider_mode: UploadProviderMode;
  status: string;
  attestation_accepted: boolean;
  upload_expires_at: Date | string | null;
  verified_at: Date | string | null;
  etag: string | null;
  uploaded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type AssetRow = {
  id: string;
  user_id: string;
  card_draft_id: string | null;
  generation_job_id: string | null;
  asset_type: string;
  s3_key: string | null;
  moderation_state: string | null;
  approved_at: Date | string | null;
  print_asset_key: string | null;
  qr_metadata: Record<string, unknown> | null;
  created_at: Date | string;
};

@Injectable()
export class UploadService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadStorageService: UploadStorageService,
    private readonly configService: ConfigService,
  ) {}

  async requestUpload(
    userId: string,
    cardDraftId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
  ) {
    await this.ensureCardDraftExists(userId, cardDraftId);
    this.validateUpload(fileName, contentType, fileSize);
    const normalizedContentType = contentType.trim().toLowerCase();

    const providerMode = this.uploadStorageService.getProviderMode();
    const storageKey = this.createStorageKey(
      providerMode,
      userId,
      cardDraftId,
      fileName,
    );
    const target = await this.uploadStorageService.createUploadTarget({
      storageKey,
      contentType: normalizedContentType,
      fileSize,
    });
    const mockUrl =
      providerMode === 'mock' ? `mock://souvenote/uploads/${storageKey}` : null;

    const result = await this.databaseService.query<UploadRow>(
      `
        INSERT INTO uploads (
          user_id,
          card_draft_id,
          filename,
          mime_type,
          size_bytes,
          storage_key,
          mock_url,
          provider_mode,
          upload_expires_at,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'requested')
        RETURNING ${this.uploadColumns};
      `,
      [
        userId,
        cardDraftId,
        fileName.trim(),
        normalizedContentType,
        fileSize,
        storageKey,
        mockUrl,
        providerMode,
        target.expiresAt,
      ],
    );

    const upload = this.toUploadResponse(result.rows[0]);

    return {
      uploadRequest: {
        ...upload,
        uploadMethod: target.uploadMethod,
        uploadUrl: target.uploadUrl,
        formFields: target.formFields,
        expiresAt: target.expiresAt,
        maxSizeBytes: this.uploadStorageService.getMaxUploadBytes(),
        mockUploadUrl: providerMode === 'mock' ? target.uploadUrl : null,
        mockKey: providerMode === 'mock' ? storageKey : null,
      },
    };
  }

  async commitUpload(
    userId: string,
    cardDraftId: string,
    storageKey: string,
    attestationAccepted: boolean,
  ) {
    await this.ensureCardDraftExists(userId, cardDraftId);

    if (!attestationAccepted) {
      throw new BadRequestException(
        'Image-rights attestation must be accepted before committing an upload.',
      );
    }

    const currentUpload = await this.findUpload(
      this.databaseService,
      userId,
      cardDraftId,
      storageKey,
    );

    if (!currentUpload) {
      throw new NotFoundException('Upload request not found.');
    }

    if (
      currentUpload.status !== 'requested' &&
      currentUpload.status !== 'uploaded'
    ) {
      throw new BadRequestException(
        `Upload cannot be committed from ${currentUpload.status} status.`,
      );
    }

    const verification = await this.uploadStorageService.verifyUpload({
      providerMode: currentUpload.provider_mode,
      storageKey: currentUpload.storage_key,
      contentType: currentUpload.mime_type,
      fileSize: currentUpload.size_bytes,
    });

    return this.databaseService.withTransaction(async (transaction) => {
      const lockedUpload = await this.findUpload(
        transaction,
        userId,
        cardDraftId,
        storageKey,
        true,
      );

      if (!lockedUpload) {
        throw new NotFoundException('Upload request not found.');
      }

      const asset = lockedUpload.asset_id
        ? await this.findOwnedAsset(
            transaction,
            lockedUpload.asset_id,
            userId,
            cardDraftId,
          )
        : await this.createUploadAsset(
            transaction,
            lockedUpload,
            verification.etag,
          );

      if (!asset) {
        throw new NotFoundException('Committed upload asset was not found.');
      }

      const updatedUpload = await transaction.query<UploadRow>(
        `
          UPDATE uploads
          SET
            status = 'uploaded',
            attestation_accepted = TRUE,
            uploaded_at = COALESCE(uploaded_at, NOW()),
            verified_at = NOW(),
            etag = COALESCE($5, etag),
            asset_id = COALESCE(asset_id, $4),
            updated_at = NOW()
          WHERE user_id = $1
            AND card_draft_id = $2
            AND storage_key = $3
          RETURNING ${this.uploadColumns};
        `,
        [userId, cardDraftId, storageKey, asset.id, verification.etag],
      );

      return {
        upload: this.toUploadResponse(updatedUpload.rows[0]),
        asset: this.toAssetResponse(asset),
      };
    });
  }

  async createMockUpload(userId: string, dto: MockUploadDto) {
    if (this.uploadStorageService.getProviderMode() !== 'mock') {
      throw new ForbiddenException(
        'The mock upload endpoint is disabled outside mock upload mode.',
      );
    }

    const request = await this.requestUpload(
      userId,
      dto.cardDraftId,
      dto.filename,
      dto.mimeType,
      dto.size,
    );

    return this.commitUpload(
      userId,
      dto.cardDraftId,
      request.uploadRequest.storageKey,
      true,
    );
  }

  private async findUpload(
    queryable: DatabaseTransaction,
    userId: string,
    cardDraftId: string,
    storageKey: string,
    forUpdate = false,
  ) {
    const result = await queryable.query<UploadRow>(
      `
        SELECT ${this.uploadColumns}
        FROM uploads
        WHERE user_id = $1
          AND card_draft_id = $2
          AND storage_key = $3
        ${forUpdate ? 'FOR UPDATE' : ''};
      `,
      [userId, cardDraftId, storageKey],
    );

    return result.rows[0];
  }

  private async findOwnedAsset(
    queryable: DatabaseTransaction,
    assetId: string,
    userId: string,
    cardDraftId: string,
  ) {
    const result = await queryable.query<AssetRow>(
      `
        SELECT ${this.assetColumns}
        FROM assets
        WHERE id = $1
          AND user_id = $2
          AND card_draft_id = $3;
      `,
      [assetId, userId, cardDraftId],
    );

    return result.rows[0];
  }

  private async createUploadAsset(
    transaction: DatabaseTransaction,
    upload: UploadRow,
    etag: string | null,
  ) {
    const moderationState =
      upload.provider_mode === 'mock' ? 'approved_mock' : 'pending';
    const source =
      upload.provider_mode === 'mock' ? 'mock_upload' : 's3_upload';
    const result = await transaction.query<AssetRow>(
      `
        INSERT INTO assets (
          user_id,
          card_draft_id,
          asset_type,
          s3_key,
          moderation_state,
          qr_metadata
        )
        VALUES ($1, $2, 'upload', $3, $4, $5::jsonb)
        RETURNING ${this.assetColumns};
      `,
      [
        upload.user_id,
        upload.card_draft_id,
        upload.storage_key,
        moderationState,
        JSON.stringify({
          source,
          providerMode: upload.provider_mode,
          filename: upload.filename,
          mimeType: upload.mime_type,
          size: upload.size_bytes,
          etag,
          ...(upload.mock_url ? { mockUrl: upload.mock_url } : {}),
        }),
      ],
    );

    const asset = result.rows[0];
    await enqueuePendingModerationJob(
      transaction,
      asset,
      resolveModerationProviderMode(this.configService),
    );

    return asset;
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

  private validateUpload(
    fileName: string,
    contentType: string,
    fileSize: number,
  ) {
    if (!fileName.trim()) {
      throw new BadRequestException('filename is required.');
    }

    const normalizedContentType = contentType.trim().toLowerCase();
    if (
      !this.uploadStorageService
        .getAllowedContentTypes()
        .has(normalizedContentType)
    ) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP image uploads are supported.',
      );
    }

    const maxUploadBytes = this.uploadStorageService.getMaxUploadBytes();
    if (
      !Number.isInteger(fileSize) ||
      fileSize <= 0 ||
      fileSize > maxUploadBytes
    ) {
      throw new BadRequestException(
        `size must be between 1 and ${maxUploadBytes} bytes.`,
      );
    }
  }

  private createStorageKey(
    providerMode: UploadProviderMode,
    userId: string,
    cardDraftId: string,
    fileName: string,
  ) {
    const safeFileName =
      fileName
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .slice(-120) || 'upload';
    const prefix = providerMode === 'mock' ? 'mock' : 'uploads';
    return `${prefix}/${userId}/${cardDraftId}/${randomUUID()}-${safeFileName}`;
  }

  private toUploadResponse(row: UploadRow) {
    return {
      id: row.id,
      userId: row.user_id,
      cardDraftId: row.card_draft_id,
      assetId: row.asset_id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size_bytes,
      providerMode: row.provider_mode,
      status: row.status,
      attestationAccepted: row.attestation_accepted,
      uploadExpiresAt: this.toIso(row.upload_expires_at),
      verifiedAt: this.toIso(row.verified_at),
      etag: row.etag,
      uploadedAt: this.toIso(row.uploaded_at),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
      mockUrl: row.mock_url,
      storageKey: row.storage_key,
    };
  }

  private toAssetResponse(row: AssetRow) {
    return {
      id: row.id,
      userId: row.user_id,
      cardDraftId: row.card_draft_id,
      generationJobId: row.generation_job_id,
      assetType: row.asset_type,
      storageKey: row.s3_key,
      mockUrl: row.s3_key?.startsWith('mock/')
        ? `mock://souvenote/${row.s3_key}`
        : null,
      moderationState: row.moderation_state,
      approvedAt: this.toIso(row.approved_at),
      printAssetKey: row.print_asset_key,
      qrMetadata: row.qr_metadata ?? {},
      createdAt: this.toIso(row.created_at),
    };
  }

  private get uploadColumns() {
    return `
      id,
      user_id,
      card_draft_id,
      asset_id,
      filename,
      mime_type,
      size_bytes,
      storage_key,
      mock_url,
      provider_mode,
      status,
      attestation_accepted,
      upload_expires_at,
      verified_at,
      etag,
      uploaded_at,
      created_at,
      updated_at
    `;
  }

  private get assetColumns() {
    return `
      id,
      user_id,
      card_draft_id,
      generation_job_id,
      asset_type,
      s3_key,
      moderation_state,
      approved_at,
      print_asset_key,
      qr_metadata,
      created_at
    `;
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
