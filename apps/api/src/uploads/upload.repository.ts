import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { UploadRequestInput } from './upload.service';

export type UploadRow = {
  id: string;
  card_draft_id: string;
  revision_id: string | null;
  original_filename: string;
  media_type: string;
  size_bytes: number | string;
  width_pixels: number | null;
  height_pixels: number | null;
  content_sha256: string;
  request_sha256: string;
  storage_key: string;
  status: string;
  content_idempotency_key: string | null;
  completion_idempotency_key: string | null;
  rights_attested_at: Date | string | null;
  committed_at: Date | string | null;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

const UPLOAD_COLUMNS = `
  id, card_draft_id, revision_id, original_filename, media_type, size_bytes,
  width_pixels, height_pixels, content_sha256, request_sha256, storage_key,
  status, content_idempotency_key, completion_idempotency_key,
  rights_attested_at, committed_at, expires_at, created_at, updated_at
`;

@Injectable()
export class UploadRepository {
  constructor(private readonly database: DatabaseService) {}

  async request(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    storageKey: string,
    input: UploadRequestInput,
  ): Promise<UploadRow> {
    return this.database.transaction(async (client) => {
      const draft = await client.query<{ current_revision_id: string | null }>(
        `SELECT current_revision_id FROM card_drafts
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
        [input.cardDraftId, userId],
      );
      const revisionId = draft.rows[0]?.current_revision_id;
      if (!revisionId) throw new NotFoundException('Card draft not found.');

      const result = await client.query<UploadRow>(
        `INSERT INTO uploads
           (user_id, card_draft_id, revision_id, original_filename, media_type,
            size_bytes, content_sha256, request_sha256, idempotency_key, storage_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, idempotency_key) DO UPDATE
           SET idempotency_key = EXCLUDED.idempotency_key
         RETURNING ${UPLOAD_COLUMNS};`,
        [
          userId,
          input.cardDraftId,
          revisionId,
          input.filename.trim(),
          input.mimeType,
          input.size,
          input.contentSha256,
          requestHash,
          idempotencyKey,
          storageKey,
        ],
      );
      const upload = this.requireRow(result.rows[0]);
      if (upload.request_sha256 !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'The Idempotency-Key was already used with a different upload request.',
        });
      }
      return upload;
    });
  }

  async get(userId: string, uploadId: string): Promise<UploadRow> {
    const result = await this.database.query<UploadRow>(
      `SELECT ${UPLOAD_COLUMNS} FROM uploads WHERE id = $1 AND user_id = $2;`,
      [uploadId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  async markContentStored(
    userId: string,
    uploadId: string,
    idempotencyKey: string,
    width: number,
    height: number,
  ): Promise<UploadRow> {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
        `upload-content:${userId}:${idempotencyKey}`,
      ]);
      const keyOwner = await client.query<{ id: string }>(
        `SELECT id FROM uploads WHERE user_id = $1 AND content_idempotency_key = $2;`,
        [userId, idempotencyKey],
      );
      if (keyOwner.rows[0] && keyOwner.rows[0].id !== uploadId) this.throwIdempotencyConflict();

      const selected = await client.query<UploadRow>(
        `SELECT ${UPLOAD_COLUMNS} FROM uploads WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
        [uploadId, userId],
      );
      const upload = this.requireRow(selected.rows[0]);
      if (upload.status === 'upload_done' && upload.content_idempotency_key === idempotencyKey) return upload;
      if (upload.status !== 'upload_pending') {
        throw new ConflictException({
          code: 'UPLOAD_STATE_CONFLICT',
          message: 'Upload content cannot be stored from its current state.',
        });
      }

      const updated = await client.query<UploadRow>(
        `UPDATE uploads
         SET status = 'upload_done', content_idempotency_key = $3,
             width_pixels = $4, height_pixels = $5
         WHERE id = $1 AND user_id = $2
         RETURNING ${UPLOAD_COLUMNS};`,
        [uploadId, userId, idempotencyKey, width, height],
      );
      return this.requireRow(updated.rows[0]);
    });
  }

  async completeMock(userId: string, uploadId: string, idempotencyKey: string): Promise<UploadRow> {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
        `upload-complete:${userId}:${idempotencyKey}`,
      ]);
      const keyOwner = await client.query<{ id: string }>(
        `SELECT id FROM uploads WHERE user_id = $1 AND completion_idempotency_key = $2;`,
        [userId, idempotencyKey],
      );
      if (keyOwner.rows[0] && keyOwner.rows[0].id !== uploadId) this.throwIdempotencyConflict();

      const selected = await client.query<UploadRow>(
        `SELECT ${UPLOAD_COLUMNS} FROM uploads WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
        [uploadId, userId],
      );
      const upload = this.requireRow(selected.rows[0]);
      if (upload.status === 'committed') {
        if (upload.completion_idempotency_key === idempotencyKey) return upload;
        throw new ConflictException({
          code: 'UPLOAD_ALREADY_COMPLETED',
          message: 'The upload was already completed with another Idempotency-Key.',
        });
      }
      if (upload.status !== 'upload_done') {
        throw new ConflictException({
          code: 'UPLOAD_CONTENT_REQUIRED',
          message: 'Validated upload content is required before completion.',
        });
      }

      await client.query(
        `UPDATE uploads SET status = 'attestation_required', completion_idempotency_key = $3
         WHERE id = $1 AND user_id = $2;`,
        [uploadId, userId, idempotencyKey],
      );
      await client.query(
        `UPDATE uploads SET status = 'attestation_done', rights_attested_at = clock_timestamp()
         WHERE id = $1 AND user_id = $2;`,
        [uploadId, userId],
      );
      await client.query(`UPDATE uploads SET status = 'moderation_pending' WHERE id = $1 AND user_id = $2;`, [
        uploadId,
        userId,
      ]);
      await client.query(
        `UPDATE uploads
         SET status = 'moderation_passed', moderation_result = '{"provider":"deterministic_mock","result":"passed"}'::jsonb
         WHERE id = $1 AND user_id = $2;`,
        [uploadId, userId],
      );
      const committed = await client.query<UploadRow>(
        `UPDATE uploads SET status = 'committed', committed_at = clock_timestamp()
         WHERE id = $1 AND user_id = $2
         RETURNING ${UPLOAD_COLUMNS};`,
        [uploadId, userId],
      );
      const row = this.requireRow(committed.rows[0]);

      const asset = await client.query<{ id: string }>(
        `INSERT INTO assets
           (user_id, card_draft_id, revision_id, asset_type, storage_key, media_type,
            content_sha256, byte_size, width_pixels, height_pixels, moderation_status,
            metadata)
         VALUES ($1, $2, $3, 'upload', $4, $5, $6, $7, $8, $9, 'passed',
                 '{"source":"validated_local_upload"}'::jsonb)
         ON CONFLICT (storage_key) DO NOTHING
         RETURNING id;`,
        [
          userId,
          row.card_draft_id,
          row.revision_id,
          row.storage_key,
          row.media_type,
          row.content_sha256,
          Number(row.size_bytes),
          row.width_pixels,
          row.height_pixels,
        ],
      );
      if (asset.rows[0]?.id) {
        await client.query(`UPDATE assets SET generation_status = 'generating' WHERE id = $1 AND user_id = $2;`, [
          asset.rows[0].id,
          userId,
        ]);
        await client.query(`UPDATE assets SET generation_status = 'ready' WHERE id = $1 AND user_id = $2;`, [
          asset.rows[0].id,
          userId,
        ]);
      }
      return row;
    });
  }

  static toApi(row: UploadRow) {
    return {
      id: row.id,
      cardDraftId: row.card_draft_id,
      revisionId: row.revision_id,
      filename: row.original_filename,
      mimeType: row.media_type,
      size: Number(row.size_bytes),
      widthPixels: row.width_pixels,
      heightPixels: row.height_pixels,
      status: row.status,
      rightsAttestedAt: row.rights_attested_at,
      committedAt: row.committed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private requireRow<T extends UploadRow>(row: T | undefined): T {
    if (!row) throw new NotFoundException('Upload not found.');
    return row;
  }

  private throwIdempotencyConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The Idempotency-Key was already used for another upload.',
    });
  }
}
