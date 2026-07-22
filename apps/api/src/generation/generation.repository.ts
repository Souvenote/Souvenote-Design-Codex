import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { GenerationAction, GenerationFailureCategory } from './generation-policy';

type JobRow = {
  id: string;
  card_draft_id: string;
  revision_id: string;
  status: string;
  request_hash: string;
  action_type: GenerationAction;
  credits_reserved: number;
  credits_refunded: number;
  approved_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const JOB_COLUMNS = `
  id, card_draft_id, revision_id, status, request_hash, action_type,
  credits_reserved, credits_refunded, approved_at, created_at, updated_at
`;

@Injectable()
export class GenerationRepository {
  constructor(private readonly database: DatabaseService) {}

  async start(
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    cardDraftId: string,
    action: GenerationAction,
    creditCost: number,
  ) {
    try {
      return await this.database.transaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [
          `generation:${userId}:${idempotencyKey}`,
        ]);
        const existing = await client.query<JobRow>(
          `SELECT ${JOB_COLUMNS} FROM generation_jobs
           WHERE user_id = $1 AND idempotency_key = $2;`,
          [userId, idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_hash !== requestHash) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'The Idempotency-Key was already used with a different generation request.',
            });
          }
          const balance = await this.balance(client, userId);
          return { job: existing.rows[0], balance };
        }

        const draft = await client.query<{ current_revision_id: string | null }>(
          `SELECT current_revision_id FROM card_drafts
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;`,
          [cardDraftId, userId],
        );
        const revisionId = draft.rows[0]?.current_revision_id;
        if (!revisionId) throw new NotFoundException('Card draft not found.');

        const jobId = randomUUID();
        const inserted = await client.query<JobRow>(
          `INSERT INTO generation_jobs
             (id, user_id, card_draft_id, revision_id, request_hash, idempotency_key,
              action_type, credits_reserved)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING ${JOB_COLUMNS};`,
          [jobId, userId, cardDraftId, revisionId, requestHash, idempotencyKey, action, creditCost],
        );
        if (creditCost > 0) {
          await client.query(
            `SELECT * FROM apply_credit_ledger_entry(
               $1, 'generation_reservation', $2, 'generation_job', $3, $4, $5::jsonb
             );`,
            [userId, -creditCost, jobId, `${idempotencyKey}:credits`, JSON.stringify({ action })],
          );
        }
        return { job: this.requireRow(inserted.rows[0]), balance: await this.balance(client, userId) };
      });
    } catch (error: unknown) {
      if (this.postgresCode(error) === '23514') {
        throw new ConflictException({
          code: 'INSUFFICIENT_CREDITS',
          message: 'The account does not have enough credits.',
        });
      }
      throw error;
    }
  }

  async failAndRefund(userId: string, jobId: string, category: GenerationFailureCategory) {
    return this.database.transaction(async (client) => {
      const selected = await client.query<JobRow>(
        `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
        [jobId, userId],
      );
      let job = this.requireRow(selected.rows[0]);
      if (job.status === 'refunded') return { job, balance: await this.balance(client, userId) };
      if (job.status === 'queued' || job.status === 'running') {
        const failed = await client.query<JobRow>(
          `UPDATE generation_jobs
           SET status = 'failed', failure_category = $3
           WHERE id = $1 AND user_id = $2
           RETURNING ${JOB_COLUMNS};`,
          [jobId, userId, category],
        );
        job = this.requireRow(failed.rows[0]);
      }
      if (job.status !== 'failed' && job.status !== 'partially_failed') {
        throw new ConflictException({
          code: 'GENERATION_NOT_REFUNDABLE',
          message: 'The generation job is not in a refundable failure state.',
        });
      }
      if (job.credits_reserved > 0) {
        await client.query(
          `SELECT * FROM apply_credit_ledger_entry(
             $1, 'generation_refund', $2, 'generation_job_failure', $3, $4, $5::jsonb
           );`,
          [
            userId,
            job.credits_reserved,
            jobId,
            `generation-refund:${jobId}`,
            JSON.stringify({ category, action: job.action_type }),
          ],
        );
      }
      const refunded = await client.query<JobRow>(
        `UPDATE generation_jobs
         SET status = 'refunded', credits_refunded = credits_reserved, failure_category = $3
         WHERE id = $1 AND user_id = $2
         RETURNING ${JOB_COLUMNS};`,
        [jobId, userId, category],
      );
      return { job: this.requireRow(refunded.rows[0]), balance: await this.balance(client, userId) };
    });
  }

  async list(userId: string, limit: number, cursor?: string): Promise<JobRow[]> {
    const result = await this.database.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM generation_jobs
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR (created_at, id) < (
           SELECT created_at, id FROM generation_jobs WHERE id = $2 AND user_id = $1
         ))
       ORDER BY created_at DESC, id DESC LIMIT $3;`,
      [userId, cursor ?? null, limit],
    );
    return result.rows;
  }

  async get(userId: string, jobId: string): Promise<JobRow> {
    const result = await this.database.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE id = $1 AND user_id = $2;`,
      [jobId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  static toApi(row: JobRow) {
    return {
      id: row.id,
      cardDraftId: row.card_draft_id,
      revisionId: row.revision_id,
      status: row.status,
      actionType: row.action_type,
      creditsReserved: row.credits_reserved,
      creditsRefunded: row.credits_refunded,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async balance(client: Pick<PoolClient, 'query'>, userId: string): Promise<number> {
    const result = await client.query<{ balance: number | string }>(
      `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
      [userId],
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  private requireRow(row: JobRow | undefined): JobRow {
    if (!row) throw new NotFoundException('Generation job not found.');
    return row;
  }

  private postgresCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
