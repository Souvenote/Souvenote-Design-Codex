import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CardDraftInput, CardDraftUpdate } from './card-drafts.service';

type CardDraftRow = {
  id: string;
  user_id: string;
  creation_route: string;
  status: string;
  occasion: string | null;
  relationship: string | null;
  creative_brief: Record<string, unknown>;
  revision_number: number;
  created_at: Date | string;
  updated_at: Date | string;
};

const SELECT_DRAFT = `
  SELECT d.id, d.user_id, d.creation_route, d.status,
         revision.occasion, revision.relationship, revision.creative_brief,
         revision.revision_number, d.created_at, d.updated_at
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

  static toApi(row: CardDraftRow) {
    return {
      id: row.id,
      creationRoute: row.creation_route,
      status: row.status,
      occasion: row.occasion,
      relationship: row.relationship,
      creativeBrief: row.creative_brief,
      revisionNumber: row.revision_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private requireRow(row: CardDraftRow | undefined): CardDraftRow {
    if (!row) throw new NotFoundException('Card draft not found.');
    return row;
  }
}
