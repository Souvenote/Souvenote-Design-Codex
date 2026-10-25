import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { MockUploadDto } from './upload.controller';

type UploadRow = {
  id: string;
  user_id: string;
  card_draft_id: string;
  asset_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  mock_url: string;
  status: string;
  attestation_accepted: boolean;
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
  constructor(private readonly databaseService: DatabaseService) {}

  async requestUpload(
    userId: string,
    cardDraftId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
  ) {
    await this.ensureCardDraftExists(userId, cardDraftId);
    this.validateUpload(fileName, contentType, fileSize);

    const storageKey = this.createMockStorageKey(cardDraftId, fileName);
    const mockUrl = `mock://souvenote/uploads/${storageKey}`;

    // TODO(Phase 2): replace this mock upload URL with an AWS S3 signed URL.
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
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested')
        RETURNING
          id,
          user_id,
          card_draft_id,
          asset_id,
          filename,
          mime_type,
          size_bytes,
          storage_key,
          mock_url,
          status,
          attestation_accepted,
          uploaded_at,
          created_at,
          updated_at;
      `,
      [userId, cardDraftId, fileName, contentType, fileSize, storageKey, mockUrl],
    );

    const upload = this.toUploadResponse(result.rows[0]);

    return {
      uploadRequest: {
        ...upload,
        mockUploadUrl: mockUrl,
        mockKey: storageKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
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

    const uploadResult = await this.databaseService.query<UploadRow>(
      `
        SELECT
          id,
          user_id,
          card_draft_id,
          asset_id,
          filename,
          mime_type,
          size_bytes,
          storage_key,
          mock_url,
          status,
          attestation_accepted,
          uploaded_at,
          created_at,
          updated_at
        FROM uploads
        WHERE user_id = $1
          AND card_draft_id = $2
          AND storage_key = $3;
      `,
      [userId, cardDraftId, storageKey],
    );

    if (uploadResult.rows.length === 0) {
      throw new NotFoundException('Upload request not found.');
    }

    const currentUpload = uploadResult.rows[0];
    let asset: AssetRow | null = null;

    if (currentUpload.asset_id) {
      const existingAsset = await this.databaseService.query<AssetRow>(
        `
          SELECT
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
          FROM assets
          WHERE id = $1;
        `,
        [currentUpload.asset_id],
      );

      asset = existingAsset.rows[0] ?? null;
    } else {
      const assetResult = await this.databaseService.query<AssetRow>(
        `
          INSERT INTO assets (
            user_id,
            card_draft_id,
            asset_type,
            s3_key,
            moderation_state,
            qr_metadata
          )
          VALUES ($1, $2, 'upload', $3, 'approved_mock', $4::jsonb)
          RETURNING
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
            created_at;
        `,
        [
          userId,
          cardDraftId,
          currentUpload.storage_key,
          JSON.stringify({
            source: 'mock_upload',
            filename: currentUpload.filename,
            mimeType: currentUpload.mime_type,
            size: currentUpload.size_bytes,
            mockUrl: currentUpload.mock_url,
          }),
        ],
      );

      asset = assetResult.rows[0];
    }

    const updatedUpload = await this.databaseService.query<UploadRow>(
      `
        UPDATE uploads
        SET
          status = 'uploaded',
          attestation_accepted = TRUE,
          uploaded_at = COALESCE(uploaded_at, NOW()),
          asset_id = COALESCE(asset_id, $4),
          updated_at = NOW()
        WHERE user_id = $1
          AND card_draft_id = $2
          AND storage_key = $3
        RETURNING
          id,
          user_id,
          card_draft_id,
          asset_id,
          filename,
          mime_type,
          size_bytes,
          storage_key,
          mock_url,
          status,
          attestation_accepted,
          uploaded_at,
          created_at,
          updated_at;
      `,
      [userId, cardDraftId, storageKey, asset?.id ?? null],
    );

    return {
      upload: this.toUploadResponse(updatedUpload.rows[0]),
      asset: asset ? this.toAssetResponse(asset) : null,
    };
  }

  async createMockUpload(dto: MockUploadDto) {
    const request = await this.requestUpload(
      dto.userId,
      dto.cardDraftId,
      dto.filename,
      dto.mimeType,
      dto.size,
    );

    return this.commitUpload(
      dto.userId,
      dto.cardDraftId,
      request.uploadRequest.mockKey,
      true,
    );
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

  private validateUpload(fileName: string, contentType: string, fileSize: number) {
    if (!fileName.trim()) {
      throw new BadRequestException('filename is required.');
    }

    if (!contentType.includes('/')) {
      throw new BadRequestException('mimeType/contentType must be valid.');
    }

    if (fileSize <= 0) {
      throw new BadRequestException('size must be greater than 0.');
    }
  }

  private createMockStorageKey(cardDraftId: string, fileName: string) {
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    return `mock/${cardDraftId}/${randomUUID()}-${safeFileName}`;
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
      status: row.status,
      attestationAccepted: row.attestation_accepted,
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
      mockUrl: row.s3_key ? `mock://souvenote/${row.s3_key}` : null,
      moderationState: row.moderation_state,
      approvedAt: this.toIso(row.approved_at),
      printAssetKey: row.print_asset_key,
      qrMetadata: row.qr_metadata ?? {},
      createdAt: this.toIso(row.created_at),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
