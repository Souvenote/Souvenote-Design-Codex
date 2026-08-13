import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CardDraftApproval, CardDraftInput, CardDraftUpdate } from './card-drafts.service';

type CardDraftRow = {
  id: string;
  user_id: string;
  creation_route: string;
  status: string;
  current_revision_id: string;
  occasion: string | null;
  relationship: string | null;
  creative_brief: Record<string, unknown>;
  revision_number: number;
  approved_image_asset_id: string | null;
  approved_song_asset_id: string | null;
  approved_message_asset_id: string | null;
  approval_idempotency_key: string | null;
  approval_request_hash: string | null;
  approved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const SELECT_DRAFT = `
  SELECT d.id, d.user_id, d.creation_route, d.status, d.current_revision_id,
         revision.occasion, revision.relationship, revision.creative_brief,
         revision.revision_number, d.approved_image_asset_id,
         d.approved_song_asset_id, d.approved_message_asset_id,
         d.approval_idempotency_key, d.approval_request_hash, d.approved_at,
         d.created_at, d.updated_at
  FROM card_drafts d
  JOIN card_draft_revisions revision ON revision.id = d.current_revision_id
`;

@Injectable()
export class CardDraftsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string, limit: number, cursor?: string): Promise<CardDraftRow[]> {
    const result = await this.database.query<CardDraftRow>(
      `${SELECT_DRAFT}
       WHERE d.user_id = $1 AND d.deleted_at IS NULL
         AND ($2::uuid IS NULL OR (d.updated_at, d.id) < (
           SELECT updated_at, id FROM card_drafts WHERE id = $2 AND user_id = $1
         ))
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT $3;`,
      [userId, cursor ?? null, limit],
    );
    return result.rows;
  }

  async get(userId: string, draftId: string): Promise<CardDraftRow> {
    const result = await this.database.query<CardDraftRow>(
      `${SELECT_DRAFT} WHERE d.id = $1 AND d.user_id = $2 AND d.deleted_at IS NULL;`,
      [draftId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  async create(userId: string, input: CardDraftInput): Promise<CardDraftRow> {
    return this.database.transaction(async (client) => {
      const draft = await client.query<{ id: string }>(
        `INSERT INTO card_drafts (user_id, creation_route)
         VALUES ($1, $2)
         RETURNING id;`,
        [userId, input.creationRoute],
      );
      const draftId = draft.rows[0]?.id;
      if (!draftId) throw new Error('Card draft insert returned no identifier.');

      const revision = await client.query<{ id: string }>(
        `INSERT INTO card_draft_revisions
           (draft_id, user_id, revision_number, occasion, relationship, creative_brief)
         VALUES ($1, $2, 1, $3, $4, $5::jsonb)
         RETURNING id;`,
        [
          draftId,
          userId,
          input.occasion?.trim() || null,
          input.relationship?.trim() || null,
          JSON.stringify(input.creativeBrief ?? {}),
        ],
      );
      await client.query(`UPDATE card_drafts SET current_revision_id = $2 WHERE id = $1 AND user_id = $3;`, [
        draftId,
        revision.rows[0]?.id,
        userId,
      ]);
      const result = await client.query<CardDraftRow>(`${SELECT_DRAFT} WHERE d.id = $1 AND d.user_id = $2;`, [
        draftId,
        userId,
      ]);
      return this.requireRow(result.rows[0]);
    });
  }

  async update(userId: string, draftId: string, input: CardDraftUpdate): Promise<CardDraftRow> {
    return this.database.transaction(async (client) => {
      const current = await client.query<CardDraftRow>(
        `${SELECT_DRAFT}
         WHERE d.id = $1 AND d.user_id = $2 AND d.deleted_at IS NULL
         FOR UPDATE OF d;`,
        [draftId, userId],
      );
      const row = this.requireRow(current.rows[0]);
      if (!['draft', 'review'].includes(row.status)) {
        throw new ConflictException({
          code: 'DRAFT_NOT_EDITABLE',
          message: 'The card draft cannot be edited from its current state.',
        });
      }
      const revision = await client.query<{ id: string }>(
        `INSERT INTO card_draft_revisions
           (draft_id, user_id, revision_number, occasion, relationship, creative_brief)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id;`,
        [
          draftId,
          userId,
          row.revision_number + 1,
          input.occasion === undefined ? row.occasion : input.occasion.trim() || null,
          input.relationship === undefined ? row.relationship : input.relationship.trim() || null,
          JSON.stringify(input.creativeBrief ?? row.creative_brief),
        ],
      );
      await client.query(
        `UPDATE card_drafts SET current_revision_id = $3, updated_at = clock_timestamp()
         WHERE id = $1 AND user_id = $2;`,
        [draftId, userId, revision.rows[0]?.id],
      );
      const result = await client.query<CardDraftRow>(`${SELECT_DRAFT} WHERE d.id = $1 AND d.user_id = $2;`, [
        draftId,
        userId,
      ]);
      return this.requireRow(result.rows[0]);
    });
  }

  async approve(
    userId: string,
    draftId: string,
    idempotencyKey: string,
    requestHash: string,
    input: CardDraftApproval,
  ): Promise<CardDraftRow> {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
        `draft-approval:${userId}:${idempotencyKey}`,
      ]);
      const keyOwner = await client.query<{ id: string; approval_request_hash: string | null }>(
        `SELECT id, approval_request_hash FROM card_drafts
         WHERE user_id = $1 AND approval_idempotency_key = $2;`,
        [userId, idempotencyKey],
      );
      if (keyOwner.rows[0] && keyOwner.rows[0].id !== draftId) this.throwApprovalConflict();

      const selected = await client.query<CardDraftRow>(
        `${SELECT_DRAFT}
         WHERE d.id = $1 AND d.user_id = $2 AND d.deleted_at IS NULL
         FOR UPDATE OF d;`,
        [draftId, userId],
      );
      const draft = this.requireRow(selected.rows[0]);
      if (draft.status === 'approved') {
        if (draft.approval_idempotency_key === idempotencyKey && draft.approval_request_hash === requestHash) {
          return draft;
        }
        this.throwApprovalConflict();
      }
      if (draft.status !== 'review') {
        throw new ConflictException({
          code: 'DRAFT_NOT_REVIEWABLE',
          message: 'The card draft must be in review before approval.',
        });
      }

      const expected = new Map<string, string>([
        [input.imageAssetId, 'image'],
        [input.messageAssetId, 'message'],
      ]);
      if (input.songAssetId) expected.set(input.songAssetId, 'song');
      const assets = await client.query<{ id: string; asset_type: string; generation_job_id: string | null }>(
        `SELECT id, asset_type, generation_job_id FROM assets
         WHERE user_id = $1 AND card_draft_id = $2 AND revision_id = $3
           AND id = ANY($4::uuid[]) AND generation_status = 'ready' AND moderation_status IN ('passed', 'not_required');`,
        [userId, draftId, draft.current_revision_id, [...expected.keys()]],
      );
      if (
        assets.rows.length !== expected.size ||
        assets.rows.some((asset) => expected.get(asset.id) !== asset.asset_type)
      ) {
        throw new NotFoundException('One or more review assets are unavailable.');
      }

      await client.query(
        `UPDATE assets SET approved_at = COALESCE(approved_at, clock_timestamp())
         WHERE user_id = $1 AND id = ANY($2::uuid[]);`,
        [userId, [...expected.keys()]],
      );
      const jobIds = assets.rows.flatMap((asset) => (asset.generation_job_id ? [asset.generation_job_id] : []));
      if (jobIds.length > 0) {
        await client.query(
          `UPDATE generation_jobs SET status = 'approved', approved_at = clock_timestamp()
           WHERE user_id = $1 AND id = ANY($2::uuid[]) AND status = 'succeeded';`,
          [userId, jobIds],
        );
      }
      const approved = await client.query<{ id: string }>(
        `UPDATE card_drafts
         SET status = 'approved', approved_image_asset_id = $3,
             approved_song_asset_id = $4, approved_message_asset_id = $5,
             approval_idempotency_key = $6, approval_request_hash = $7,
             approved_at = clock_timestamp()
         WHERE id = $1 AND user_id = $2
         RETURNING id;`,
        [
          draftId,
          userId,
          input.imageAssetId,
          input.songAssetId ?? null,
          input.messageAssetId,
          idempotencyKey,
          requestHash,
        ],
      );
      if (!approved.rows[0]) throw new Error('Card draft approval returned no row.');
      const result = await client.query<CardDraftRow>(`${SELECT_DRAFT} WHERE d.id = $1 AND d.user_id = $2;`, [
        draftId,
        userId,
      ]);
      return this.requireRow(result.rows[0]);
    });
  }

  static toApi(row: CardDraftRow) {
    return {
      id: row.id,
      creationRoute: row.creation_route,
      status: row.status,
      occasion: row.occasion,
      relationship: row.relationship,
      creativeBrief: row.creative_brief,
      revisionNumber: row.revision_number,
      approvedImageAssetId: row.approved_image_asset_id,
      approvedSongAssetId: row.approved_song_asset_id,
      approvedMessageAssetId: row.approved_message_asset_id,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private requireRow(row: CardDraftRow | undefined): CardDraftRow {
    if (!row) throw new NotFoundException('Card draft not found.');
    return row;
  }

  private throwApprovalConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The approval Idempotency-Key was already used with different input.',
    });
  }
}
