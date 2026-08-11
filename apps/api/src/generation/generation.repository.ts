import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import type { GeneratedAssetType } from './deterministic-generation.provider';
import type { GenerationAction, GenerationFailureCategory } from './generation-policy';

export type JobRow = {
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

export type MockGenerationContext = {
  job: JobRow;
  creativeBrief: Record<string, unknown>;
};

export type StoredMockAsset = {
  assetType: GeneratedAssetType;
  storageKey: string;
  mediaType: string;
  contentSha256: string;
  byteSize: number;
  widthPixels: number | null;
  heightPixels: number | null;
  durationSeconds: number | null;
  moderationStatus: 'passed' | 'not_required';
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
          if (existing.rows[0].request_hash !== requestHash) this.throwIdempotencyConflict();
          return { job: existing.rows[0], balance: await this.balance(client, userId), created: false };
        }

        const draft = await client.query<{ current_revision_id: string | null; status: string }>(
          `SELECT current_revision_id, status FROM card_drafts
           WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE;`,
          [cardDraftId, userId],
        );
        const revisionId = draft.rows[0]?.current_revision_id;
        if (!revisionId) throw new NotFoundException('Card draft not found.');
        if (!['draft', 'review'].includes(draft.rows[0]?.status ?? '')) {
          throw new ConflictException({
            code: 'DRAFT_NOT_GENERATABLE',
            message: 'The card draft cannot start generation from its current state.',
          });
        }

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
        return {
          job: this.requireRow(inserted.rows[0]),
          balance: await this.balance(client, userId),
          created: true,
        };
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

  async beginMock(userId: string, jobId: string, assetTypes: GeneratedAssetType[]): Promise<MockGenerationContext> {
    return this.database.transaction(async (client) => {
      const selected = await client.query<JobRow & { creative_brief: Record<string, unknown> }>(
        `SELECT job.id, job.card_draft_id, job.revision_id, job.status,
                job.request_hash, job.action_type, job.credits_reserved,
                job.credits_refunded, job.approved_at, job.created_at,
                job.updated_at, revision.creative_brief
         FROM generation_jobs job
         JOIN card_draft_revisions revision ON revision.id = job.revision_id AND revision.user_id = job.user_id
         WHERE job.id = $1 AND job.user_id = $2
         FOR UPDATE OF job;`,
        [jobId, userId],
      );
      const job = this.requireRow(selected.rows[0]);
      if (job.status !== 'queued') {
        throw new ConflictException({ code: 'GENERATION_STATE_CONFLICT', message: 'Generation job is not queued.' });
      }
      const running = await client.query<JobRow>(
        `UPDATE generation_jobs SET status = 'running'
         WHERE id = $1 AND user_id = $2 RETURNING ${JOB_COLUMNS};`,
        [jobId, userId],
      );
      const draftUpdate = await client.query(
        `UPDATE card_drafts SET status = 'generating'
         WHERE id = $1 AND user_id = $2 AND status IN ('draft', 'review') RETURNING id;`,
        [job.card_draft_id, userId],
      );
      if (!draftUpdate.rows[0]) {
        throw new ConflictException({ code: 'DRAFT_NOT_GENERATABLE', message: 'Card draft is not ready to generate.' });
      }
      for (const [index, assetType] of assetTypes.entries()) {
        const attempt = await client.query<{ id: string }>(
          `INSERT INTO provider_attempts
             (user_id, generation_job_id, asset_type, provider, model, model_version,
              attempt_number, input_hash, cost_amount_minor, cost_currency)
           VALUES ($1, $2, $3, 'deterministic_mock', 'souvenote-section-4', '1', $4, $5, 0, 'CAD')
           RETURNING id;`,
          [userId, jobId, assetType, index + 1, job.request_hash],
        );
        await client.query(
          `UPDATE provider_attempts SET status = 'running', started_at = clock_timestamp()
           WHERE id = $1 AND user_id = $2;`,
          [attempt.rows[0]?.id, userId],
        );
      }
      return {
        job: this.requireRow(running.rows[0]),
        creativeBrief: selected.rows[0]?.creative_brief ?? {},
      };
    });
  }

  async completeMock(userId: string, jobId: string, assets: StoredMockAsset[]) {
    return this.database.transaction(async (client) => {
      const job = await this.lockRunningJob(client, userId, jobId);
      for (const asset of assets) await this.persistSuccessfulAsset(client, userId, job, asset);
      const completed = await client.query<JobRow>(
        `UPDATE generation_jobs SET status = 'succeeded'
         WHERE id = $1 AND user_id = $2 RETURNING ${JOB_COLUMNS};`,
        [jobId, userId],
      );
      await client.query(
        `UPDATE card_drafts SET status = 'review' WHERE id = $1 AND user_id = $2 AND status = 'generating';`,
        [job.card_draft_id, userId],
      );
      await this.audit(client, userId, jobId, 'generation.mock_succeeded', 'succeeded', {
        action: job.action_type,
        asset_types: assets.map((asset) => asset.assetType),
        external_cost_minor: 0,
      });
      return { job: this.requireRow(completed.rows[0]), balance: await this.balance(client, userId) };
    });
  }

  async failMock(
    userId: string,
    jobId: string,
    successfulAssets: StoredMockAsset[],
    failedAssetType: GeneratedAssetType,
    category: GenerationFailureCategory,
  ) {
    return this.database.transaction(async (client) => {
      const job = await this.lockRunningJob(client, userId, jobId);
      for (const asset of successfulAssets) await this.persistSuccessfulAsset(client, userId, job, asset);
      await client.query(
        `UPDATE provider_attempts
         SET status = 'failed', error_category = $4, completed_at = clock_timestamp()
         WHERE generation_job_id = $1 AND user_id = $2 AND status = 'running' AND asset_type = $3;`,
        [jobId, userId, failedAssetType, category],
      );
      await client.query(
        `UPDATE provider_attempts
         SET status = 'failed', error_category = 'not_run_after_failure', completed_at = clock_timestamp()
         WHERE generation_job_id = $1 AND user_id = $2 AND status = 'running';`,
        [jobId, userId],
      );
      const failedStatus = successfulAssets.length > 0 ? 'partially_failed' : 'failed';
      await client.query(
        `UPDATE generation_jobs SET status = $3, failure_category = $4 WHERE id = $1 AND user_id = $2;`,
        [jobId, userId, failedStatus, category],
      );
      await this.refund(client, userId, job, category);
      const refunded = await client.query<JobRow>(
        `UPDATE generation_jobs
         SET status = 'refunded', credits_refunded = credits_reserved, failure_category = $3
         WHERE id = $1 AND user_id = $2 RETURNING ${JOB_COLUMNS};`,
        [jobId, userId, category],
      );
      const readyAssets = await client.query<{ present: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM assets WHERE user_id = $1 AND card_draft_id = $2 AND generation_status = 'ready'
         ) AS present;`,
        [userId, job.card_draft_id],
      );
      await client.query(
        `UPDATE card_drafts SET status = $3
         WHERE id = $1 AND user_id = $2 AND status = 'generating';`,
        [job.card_draft_id, userId, readyAssets.rows[0]?.present ? 'review' : 'draft'],
      );
      await this.audit(client, userId, jobId, 'generation.mock_failed', 'failed', {
        action: job.action_type,
        failed_asset_type: failedAssetType,
        failure_category: category,
        refunded_credits: job.credits_reserved,
      });
      return { job: this.requireRow(refunded.rows[0]), balance: await this.balance(client, userId) };
    });
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
          `UPDATE generation_jobs SET status = 'failed', failure_category = $3
           WHERE id = $1 AND user_id = $2 RETURNING ${JOB_COLUMNS};`,
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
      await this.refund(client, userId, job, category);
      const refunded = await client.query<JobRow>(
        `UPDATE generation_jobs
         SET status = 'refunded', credits_refunded = credits_reserved, failure_category = $3
         WHERE id = $1 AND user_id = $2 RETURNING ${JOB_COLUMNS};`,
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

  private async lockRunningJob(client: PoolClient, userId: string, jobId: string): Promise<JobRow> {
    const selected = await client.query<JobRow>(
      `SELECT ${JOB_COLUMNS} FROM generation_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE;`,
      [jobId, userId],
    );
    const job = this.requireRow(selected.rows[0]);
    if (job.status !== 'running') {
      throw new ConflictException({ code: 'GENERATION_STATE_CONFLICT', message: 'Generation job is not running.' });
    }
    return job;
  }

  private async persistSuccessfulAsset(
    client: PoolClient,
    userId: string,
    job: JobRow,
    asset: StoredMockAsset,
  ): Promise<void> {
    const attempt = await client.query<{ id: string }>(
      `UPDATE provider_attempts
       SET status = 'succeeded', result_storage_key = $4,
           moderation_result = $5::jsonb, completed_at = clock_timestamp()
       WHERE generation_job_id = $1 AND user_id = $2 AND asset_type = $3 AND status = 'running'
       RETURNING id;`,
      [
        job.id,
        userId,
        asset.assetType,
        asset.storageKey,
        JSON.stringify({ provider: 'deterministic_mock', result: asset.moderationStatus }),
      ],
    );
    const attemptId = attempt.rows[0]?.id;
    if (!attemptId) throw new Error('Deterministic provider attempt was not running.');
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO assets
         (user_id, card_draft_id, revision_id, generation_job_id, provider_attempt_id,
          asset_type, storage_key, media_type, content_sha256, byte_size,
          width_pixels, height_pixels, duration_seconds, moderation_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               '{"provider":"deterministic_mock","external_calls":false}'::jsonb)
       RETURNING id;`,
      [
        userId,
        job.card_draft_id,
        job.revision_id,
        job.id,
        attemptId,
        asset.assetType,
        asset.storageKey,
        asset.mediaType,
        asset.contentSha256,
        asset.byteSize,
        asset.widthPixels,
        asset.heightPixels,
        asset.durationSeconds,
        asset.moderationStatus,
      ],
    );
    const assetId = inserted.rows[0]?.id;
    if (!assetId) throw new Error('Generated asset insert returned no identifier.');
    await client.query(`UPDATE assets SET generation_status = 'generating' WHERE id = $1 AND user_id = $2;`, [
      assetId,
      userId,
    ]);
    await client.query(`UPDATE assets SET generation_status = 'ready' WHERE id = $1 AND user_id = $2;`, [
      assetId,
      userId,
    ]);
  }

  private async refund(
    client: PoolClient,
    userId: string,
    job: JobRow,
    category: GenerationFailureCategory,
  ): Promise<void> {
    if (job.credits_reserved <= 0) return;
    await client.query(
      `SELECT * FROM apply_credit_ledger_entry(
         $1, 'generation_refund', $2, 'generation_job_failure', $3, $4, $5::jsonb
       );`,
      [
        userId,
        job.credits_reserved,
        job.id,
        `generation-refund:${job.id}`,
        JSON.stringify({ category, action: job.action_type }),
      ],
    );
  }

  private async audit(
    client: PoolClient,
    userId: string,
    jobId: string,
    action: string,
    outcome: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_events
         (actor_user_id, subject_user_id, action, entity_type, entity_id, outcome, metadata)
       VALUES ($1, $1, $2, 'generation_job', $3, $4, $5::jsonb);`,
      [userId, action, jobId, outcome, JSON.stringify(metadata)],
    );
  }

  private async balance(client: Pick<PoolClient, 'query'>, userId: string): Promise<number> {
    const result = await client.query<{ balance: number | string }>(
      `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
      [userId],
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  private requireRow<T extends JobRow>(row: T | undefined): T {
    if (!row) throw new NotFoundException('Generation job not found.');
    return row;
  }

  private throwIdempotencyConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'The Idempotency-Key was already used with a different generation request.',
    });
  }

  private postgresCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  }
}
