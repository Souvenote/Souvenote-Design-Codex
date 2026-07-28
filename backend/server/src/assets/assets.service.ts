import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { DatabaseService } from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';

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
export class AssetsServices {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadStorageService: UploadStorageService,
    @Optional()
    private readonly analyticsService?: AnalyticsService,
  ) {}

  async getCardDraft(userId: string, cardDraftId: string) {
    const result = await this.databaseService.query<AssetRow>(
      `SELECT
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
       WHERE card_draft_id = $1
         AND user_id = $2
       ORDER BY created_at ASC;`,
      [cardDraftId, userId],
    );

    return {
      cardDraftId,
      assets: await Promise.all(
        result.rows.map((asset) => this.toAssetResponse(asset)),
      ),
    };
  }

  async approveCardDraftAssets(
    userId: string,
    cardDraftId: string,
    assetIds: string[],
  ) {
    const result = await this.databaseService.query<AssetRow>(
      `
        WITH requested AS (
          SELECT DISTINCT UNNEST($3::uuid[]) AS id
        ),
        eligible AS (
          SELECT asset.id, asset.asset_type
          FROM assets asset
          INNER JOIN requested ON requested.id = asset.id
          WHERE asset.user_id = $1
            AND asset.card_draft_id = $2
            AND asset.generation_job_id IS NOT NULL
            AND asset.asset_type IN ('image', 'song', 'message')
            AND asset.s3_key IS NOT NULL
            AND asset.moderation_state IN ('approved', 'approved_mock')
          FOR UPDATE OF asset
        ),
        approval_gate AS (
          SELECT
            (SELECT COUNT(*) FROM requested) AS requested_count,
            COUNT(*) AS eligible_count,
            COUNT(DISTINCT asset_type) AS asset_type_count
          FROM eligible
        ),
        updated AS (
          UPDATE assets asset
          SET approved_at = COALESCE(asset.approved_at, NOW())
          FROM approval_gate
          WHERE asset.id IN (SELECT id FROM eligible)
            AND asset.user_id = $1
            AND asset.card_draft_id = $2
            AND asset.generation_job_id IS NOT NULL
            AND asset.asset_type IN ('image', 'song', 'message')
            AND asset.s3_key IS NOT NULL
            AND asset.moderation_state IN ('approved', 'approved_mock')
            AND approval_gate.requested_count = approval_gate.eligible_count
            AND approval_gate.eligible_count = approval_gate.asset_type_count
          RETURNING
            asset.id,
            asset.user_id,
            asset.card_draft_id,
            asset.generation_job_id,
            asset.asset_type,
            asset.s3_key,
            asset.moderation_state,
            asset.approved_at,
            asset.print_asset_key,
            asset.qr_metadata,
            asset.created_at
        )
        SELECT *
        FROM updated
        ORDER BY created_at ASC;
      `,
      [userId, cardDraftId, assetIds],
    );

    if (result.rows.length !== assetIds.length) {
      throw new ConflictException(
        'Every selected asset must be an owned generated asset with approved moderation.',
      );
    }
    this.analyticsService?.generationApproved(userId, cardDraftId, {
      providerMode: 'unknown',
      assetCount: result.rows.length,
    });

    return {
      cardDraftId,
      assets: await Promise.all(
        result.rows.map((asset) => this.toAssetResponse(asset)),
      ),
    };
  }

  private async toAssetResponse(asset: AssetRow) {
    const readUrl =
      asset.s3_key && asset.asset_type !== 'message'
        ? await this.uploadStorageService.createReadUrl(asset.s3_key)
        : null;
    return {
      ...asset,
      userId: asset.user_id,
      cardDraftId: asset.card_draft_id,
      generationJobId: asset.generation_job_id,
      assetType: asset.asset_type,
      storageKey: asset.s3_key,
      mockUrl: asset.s3_key?.startsWith('mock/')
        ? `mock://souvenote/${asset.s3_key}`
        : null,
      readUrl,
      moderationState: asset.moderation_state,
      approvedAt: this.toIso(asset.approved_at),
      printAssetKey: asset.print_asset_key,
      qrMetadata: asset.qr_metadata ?? {},
      createdAt: this.toIso(asset.created_at),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
