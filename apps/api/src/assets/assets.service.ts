import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

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
  constructor(private readonly databaseService: DatabaseService) {}

  async getCardDraft(cardDraftId: string) {
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
       ORDER BY created_at ASC;`,
      [cardDraftId],
    );

    return {
      cardDraftId,
      assets: result.rows.map((asset) => ({
        ...asset,
        userId: asset.user_id,
        cardDraftId: asset.card_draft_id,
        generationJobId: asset.generation_job_id,
        assetType: asset.asset_type,
        storageKey: asset.s3_key,
        mockUrl: asset.s3_key ? `mock://souvenote/${asset.s3_key}` : null,
        moderationState: asset.moderation_state,
        approvedAt: this.toIso(asset.approved_at),
        printAssetKey: asset.print_asset_key,
        qrMetadata: asset.qr_metadata ?? {},
        createdAt: this.toIso(asset.created_at),
      })),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) {
      return null;
    }

    return value instanceof Date ? value.toISOString() : value;
  }
}
