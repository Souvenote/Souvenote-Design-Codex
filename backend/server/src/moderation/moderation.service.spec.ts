import { ConflictException } from '@nestjs/common';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { ModerationService } from './moderation.service';

const pendingRow = {
  job_id: '11111111-1111-4111-8111-111111111111',
  provider_mode: 'manual',
  job_status: 'pending',
  attempt_number: 1,
  reviewed_by: null,
  started_at: null,
  completed_at: null,
  job_created_at: '2026-07-22T12:00:00.000Z',
  asset_id: '22222222-2222-4222-8222-222222222222',
  asset_owner_id: '33333333-3333-4333-8333-333333333333',
  card_draft_id: '44444444-4444-4444-8444-444444444444',
  generation_job_id: null,
  asset_type: 'upload',
  s3_key: 'uploads/user-a/draft-a/photo.png',
  moderation_state: 'pending',
  moderation_reason_code: null,
  moderated_at: null,
  asset_created_at: '2026-07-22T12:00:00.000Z',
};

describe('ModerationService', () => {
  const query = jest.fn();
  const transactionQuery = jest.fn();
  const transaction = {
    query: transactionQuery,
  } as unknown as DatabaseTransaction;
  const withTransaction = jest.fn(
    <T>(operation: (active: DatabaseTransaction) => Promise<T>) =>
      operation(transaction),
  );
  const databaseService = {
    query,
    withTransaction,
  } as unknown as DatabaseService;
  const createReadUrl = jest.fn();
  const uploadStorageService = {
    createReadUrl,
  } as unknown as UploadStorageService;
  const service = new ModerationService(databaseService, uploadStorageService);

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
    createReadUrl.mockReset();
  });

  it('lists pending jobs with short-lived private asset URLs', async () => {
    query.mockResolvedValue({ rows: [pendingRow] });
    createReadUrl.mockResolvedValue(
      'https://souvenote.s3.example/photo.png?signature=test',
    );

    const response = await service.listPendingJobs(25);
    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0]?.moderationJob).toMatchObject({
      id: pendingRow.job_id,
      status: 'pending',
    });
    expect(response.jobs[0]?.asset).toMatchObject({
      id: pendingRow.asset_id,
      readUrl: 'https://souvenote.s3.example/photo.png?signature=test',
    });
    expect(response.jobs[0]?.idempotentReplay).toBe(false);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $1'),
      [25],
    );
    expect(createReadUrl).toHaveBeenCalledWith(pendingRow.s3_key);
  });

  it('atomically approves an asset and writes a reviewer audit event', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [pendingRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...pendingRow,
            moderation_state: 'approved',
            moderated_at: '2026-07-22T12:05:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            job_id: pendingRow.job_id,
            provider_mode: 'manual',
            job_status: 'approved',
            attempt_number: 1,
            reviewed_by: 'reviewer-a',
            started_at: '2026-07-22T12:05:00.000Z',
            completed_at: '2026-07-22T12:05:00.000Z',
            job_created_at: pendingRow.job_created_at,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.recordDecision(
        'reviewer-a',
        pendingRow.job_id,
        'approved',
        'safe_content',
      ),
    ).resolves.toMatchObject({
      moderationJob: { status: 'approved', reviewedBy: 'reviewer-a' },
      asset: { moderationState: 'approved' },
      idempotentReplay: false,
    });

    expect(transactionQuery).toHaveBeenCalledTimes(4);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO audit_logs'),
      [
        'reviewer-a',
        'asset_moderation_approved',
        pendingRow.asset_id,
        expect.stringContaining('safe_content'),
      ],
    );
  });

  it('clears prior user approval when moderation rejects an asset', async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [pendingRow] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...pendingRow,
            moderation_state: 'rejected',
            moderation_reason_code: 'unsafe_content',
            moderated_at: '2026-07-22T12:05:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            job_id: pendingRow.job_id,
            provider_mode: 'manual',
            job_status: 'rejected',
            attempt_number: 1,
            reviewed_by: 'reviewer-a',
            started_at: '2026-07-22T12:05:00.000Z',
            completed_at: '2026-07-22T12:05:00.000Z',
            job_created_at: pendingRow.job_created_at,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.recordDecision(
      'reviewer-a',
      pendingRow.job_id,
      'rejected',
      'unsafe_content',
    );

    expect(transactionQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("WHEN $2 = 'rejected' THEN NULL"),
      [pendingRow.asset_id, 'rejected', 'unsafe_content'],
    );
  });

  it('replays an identical completed decision without another audit write', async () => {
    transactionQuery.mockResolvedValueOnce({
      rows: [
        {
          ...pendingRow,
          job_status: 'approved',
          moderation_state: 'approved',
          reviewed_by: 'reviewer-a',
        },
      ],
    });

    await expect(
      service.recordDecision('reviewer-b', pendingRow.job_id, 'approved'),
    ).resolves.toMatchObject({
      moderationJob: { status: 'approved', reviewedBy: 'reviewer-a' },
      idempotentReplay: true,
    });

    expect(transactionQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects an attempt to reverse a completed moderation decision', async () => {
    transactionQuery.mockResolvedValueOnce({
      rows: [
        {
          ...pendingRow,
          job_status: 'rejected',
          moderation_state: 'rejected',
        },
      ],
    });

    await expect(
      service.recordDecision('reviewer-a', pendingRow.job_id, 'approved'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionQuery).toHaveBeenCalledTimes(1);
  });
});
