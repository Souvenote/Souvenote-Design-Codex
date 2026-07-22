import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type PublicCardRow = {
  id: string;
  card_draft_id: string;
  public_path: string;
  qr_payload_version: number;
  expires_at: Date | string | null;
  song_asset_id: string | null;
  song_status: string | null;
  song_duration_seconds: number | string | null;
};

@Injectable()
export class PublicCardsRepository {
  constructor(private readonly database: DatabaseService) {}

  async get(tokenHash: string): Promise<PublicCardRow> {
    const result = await this.database.query<PublicCardRow>(
      `SELECT link.id, link.card_draft_id, link.public_path, link.qr_payload_version,
              link.expires_at, song.id AS song_asset_id, song.generation_status AS song_status,
              song.duration_seconds AS song_duration_seconds
       FROM card_share_links link
       LEFT JOIN assets song ON song.id = link.song_asset_id AND song.user_id = link.user_id
       WHERE link.token_hash = $1 AND link.revoked_at IS NULL
         AND (link.expires_at IS NULL OR link.expires_at > clock_timestamp());`,
      [tokenHash],
    );
    const card = result.rows[0];
    if (!card) throw new NotFoundException('Shared card not found.');
    return card;
  }

  static toApi(row: PublicCardRow) {
    return {
      id: row.id,
      publicPath: row.public_path,
      qrPayloadVersion: row.qr_payload_version,
      expiresAt: row.expires_at,
      song: row.song_asset_id
        ? {
            id: row.song_asset_id,
            status: row.song_status,
            durationSeconds: row.song_duration_seconds === null ? null : Number(row.song_duration_seconds),
          }
        : null,
    };
  }
}
