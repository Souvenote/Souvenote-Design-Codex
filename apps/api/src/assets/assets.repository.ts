import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type AssetRow = {
  id: string;
  card_draft_id: string;
  revision_id: string;
  generation_job_id: string | null;
  asset_type: string;
  generation_status: string;
  media_type: string;
  byte_size: number | string;
  width_pixels: number | null;
  height_pixels: number | null;
  duration_seconds: number | string | null;
  moderation_status: string;
  approved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const ASSET_COLUMNS = `
  id, card_draft_id, revision_id, generation_job_id, asset_type,
  generation_status, media_type, byte_size, width_pixels, height_pixels,
  duration_seconds, moderation_status, approved_at, created_at, updated_at
`;

@Injectable()
export class AssetsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string, limit: number, cursor?: string, cardDraftId?: string): Promise<AssetRow[]> {
    const result = await this.database.query<AssetRow>(
      `SELECT ${ASSET_COLUMNS}
       FROM assets
       WHERE user_id = $1 AND ($2::uuid IS NULL OR card_draft_id = $2)
         AND ($3::uuid IS NULL OR (created_at, id) < (
           SELECT created_at, id FROM assets WHERE id = $3 AND user_id = $1
         ))
       ORDER BY created_at DESC, id DESC
       LIMIT $4;`,
      [userId, cardDraftId ?? null, cursor ?? null, limit],
    );
    return result.rows;
  }

  async get(userId: string, assetId: string): Promise<AssetRow> {
    const result = await this.database.query<AssetRow>(
      `SELECT ${ASSET_COLUMNS} FROM assets WHERE id = $1 AND user_id = $2;`,
      [assetId, userId],
    );
    const asset = result.rows[0];
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  static toApi(row: AssetRow) {
    return {
      id: row.id,
      cardDraftId: row.card_draft_id,
      revisionId: row.revision_id,
      generationJobId: row.generation_job_id,
      assetType: row.asset_type,
      generationStatus: row.generation_status,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      widthPixels: row.width_pixels,
      heightPixels: row.height_pixels,
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      moderationStatus: row.moderation_status,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
