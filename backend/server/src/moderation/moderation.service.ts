import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';

type ModerationDecision = 'approved' | 'rejected';

type ModerationQueueRow = {
  job_id: string;
  provider_mode: string;
  job_status: string;
  attempt_number: number;
  reviewed_by: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  job_created_at: Date | string;
  asset_id: string;
  asset_owner_id: string;
  card_draft_id: string | null;
  generation_job_id: string | null;
  asset_type: string;
  s3_key: string | null;
  moderation_state: string;
  moderation_reason_code: string | null;
  moderated_at: Date | string | null;
  asset_created_at: Date | string;
};

@Injectable()
export class ModerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async listPendingJobs(limit: number) {
    const result = await this.databaseService.query<ModerationQueueRow>(
      `
        SELECT
          moderation_job.id AS job_id,
          moderation_job.provider_mode,
          moderation_job.status AS job_status,
          moderation_job.attempt_number,
          moderation_job.reviewed_by,
          moderation_job.started_at,
          moderation_job.completed_at,
          moderation_job.created_at AS job_created_at,
          asset.id AS asset_id,
          asset.user_id AS asset_owner_id,
          asset.card_draft_id,
          asset.generation_job_id,
          asset.asset_type,
          asset.s3_key,
          asset.moderation_state,
          asset.moderation_reason_code,
          asset.moderated_at,
          asset.created_at AS asset_created_at
        FROM asset_moderation_jobs moderation_job
        INNER JOIN assets asset ON asset.id = moderation_job.asset_id
        WHERE moderation_job.status IN ('pending', 'running')
          AND asset.moderation_state = 'pending'
        ORDER BY moderation_job.created_at ASC, moderation_job.id ASC
        LIMIT $1;
      `,
      [limit],
    );

    const jobs = await Promise.all(
      result.rows.map(async (row) =>
        this.toResponse(
          row,
          row.s3_key
            ? await this.uploadStorageService.createReadUrl(row.s3_key)
            : null,
          false,
        ),
      ),
    );

    return { jobs };
  }

  async recordDecision(
    reviewerUserId: string,
    jobId: string,
    decision: ModerationDecision,
    reasonCode?: string,
  ) {
    return this.databaseService.withTransaction(async (transaction) => {
      const current = await this.findJobForUpdate(transaction, jobId);
      if (!current) {
        throw new NotFoundException('Moderation job not found.');
      }

      if (current.job_status === decision) {
        if (current.moderation_state !== decision) {
          throw new ConflictException(
            'Moderation job and asset states do not agree.',
          );
        }
        return this.toResponse(current, null, true);
      }

      if (!['pending', 'running'].includes(current.job_status)) {
        throw new ConflictException(
          `Moderation cannot continue from ${current.job_status} status.`,
        );
      }

      const updatedAsset = await transaction.query<ModerationQueueRow>(
        `
          UPDATE assets
          SET
            moderation_state = $2,
            moderation_reason_code = $3,
            moderated_at = NOW(),
            approved_at = CASE
              WHEN $2 = 'rejected' THEN NULL
              ELSE approved_at
            END
          WHERE id = $1
          RETURNING
            id AS asset_id,
            user_id AS asset_owner_id,
            card_draft_id,
            generation_job_id,
            asset_type,
            s3_key,
            moderation_state,
            moderation_reason_code,
            moderated_at,
            created_at AS asset_created_at;
        `,
        [current.asset_id, decision, reasonCode ?? null],
      );

      const updatedJob = await transaction.query<ModerationQueueRow>(
        `
          UPDATE asset_moderation_jobs
          SET
            status = $2,
            result_metadata = $3::jsonb,
            error_message = NULL,
            reviewed_by = $4,
            started_at = COALESCE(started_at, NOW()),
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id AS job_id,
            provider_mode,
            status AS job_status,
            attempt_number,
            reviewed_by,
            started_at,
            completed_at,
            created_at AS job_created_at;
        `,
        [
          current.job_id,
          decision,
          JSON.stringify({
            decisionSource: 'human_review',
            ...(reasonCode ? { reasonCode } : {}),
          }),
          reviewerUserId,
        ],
      );

      await transaction.query(
        `
          INSERT INTO audit_logs (
            user_id,
            action,
            entity_type,
            entity_id,
            metadata
          )
          VALUES ($1, $2, 'asset', $3, $4::jsonb);
        `,
        [
          reviewerUserId,
          `asset_moderation_${decision}`,
          current.asset_id,
          JSON.stringify({
            moderationJobId: current.job_id,
            assetOwnerId: current.asset_owner_id,
            decisionSource: 'human_review',
            ...(reasonCode ? { reasonCode } : {}),
          }),
        ],
      );

      return this.toResponse(
        {
          ...current,
          ...updatedAsset.rows[0],
          ...updatedJob.rows[0],
        },
        null,
        false,
      );
    });
  }

  private async findJobForUpdate(
    transaction: DatabaseTransaction,
    jobId: string,
  ) {
    const result = await transaction.query<ModerationQueueRow>(
      `
        SELECT
          moderation_job.id AS job_id,
          moderation_job.provider_mode,
          moderation_job.status AS job_status,
          moderation_job.attempt_number,
          moderation_job.reviewed_by,
          moderation_job.started_at,
          moderation_job.completed_at,
          moderation_job.created_at AS job_created_at,
          asset.id AS asset_id,
          asset.user_id AS asset_owner_id,
          asset.card_draft_id,
          asset.generation_job_id,
          asset.asset_type,
          asset.s3_key,
          asset.moderation_state,
          asset.moderation_reason_code,
          asset.moderated_at,
          asset.created_at AS asset_created_at
        FROM asset_moderation_jobs moderation_job
        INNER JOIN assets asset ON asset.id = moderation_job.asset_id
        WHERE moderation_job.id = $1
        FOR UPDATE OF moderation_job, asset;
      `,
      [jobId],
    );

    return result.rows[0];
  }

  private toResponse(
    row: ModerationQueueRow,
    readUrl: string | null,
    idempotentReplay: boolean,
  ) {
    return {
      moderationJob: {
        id: row.job_id,
        providerMode: row.provider_mode,
        status: row.job_status,
        attemptNumber: row.attempt_number,
        reviewedBy: row.reviewed_by,
        startedAt: this.toIso(row.started_at),
        completedAt: this.toIso(row.completed_at),
        createdAt: this.toIso(row.job_created_at),
      },
      asset: {
        id: row.asset_id,
        ownerId: row.asset_owner_id,
        cardDraftId: row.card_draft_id,
        generationJobId: row.generation_job_id,
        assetType: row.asset_type,
        moderationState: row.moderation_state,
        moderationReasonCode: row.moderation_reason_code,
        moderatedAt: this.toIso(row.moderated_at),
        createdAt: this.toIso(row.asset_created_at),
        readUrl,
      },
      idempotentReplay,
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }
}
