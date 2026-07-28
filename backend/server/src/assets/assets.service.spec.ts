import { ConflictException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { DatabaseService } from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { AssetsServices } from './assets.service';

describe('AssetsServices', () => {
  const query = jest.fn();
  const databaseService = { query } as unknown as DatabaseService;
  const createReadUrl = jest.fn();
  const uploadStorageService = {
    createReadUrl,
  } as unknown as UploadStorageService;
  const generationApproved = jest.fn();
  const service = new AssetsServices(databaseService, uploadStorageService, {
    generationApproved,
  } as unknown as AnalyticsService);

  beforeEach(() => {
    query.mockReset();
    createReadUrl.mockReset();
    generationApproved.mockReset().mockResolvedValue(undefined);
    createReadUrl.mockImplementation((storageKey: string) =>
      Promise.resolve(
        storageKey.startsWith('mock/')
          ? null
          : 'https://private.s3.example/asset?signature=test',
      ),
    );
  });

  it('exposes mock URLs only for mock storage keys', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 'asset-mock',
          user_id: 'user-a',
          card_draft_id: 'draft-a',
          generation_job_id: 'job-a',
          asset_type: 'image',
          s3_key: 'mock/generation/job-a/card-image.png',
          moderation_state: 'approved_mock',
          approved_at: null,
          print_asset_key: null,
          qr_metadata: {},
          created_at: '2026-07-22T12:00:00.000Z',
        },
        {
          id: 'asset-s3',
          user_id: 'user-a',
          card_draft_id: 'draft-a',
          generation_job_id: null,
          asset_type: 'upload',
          s3_key: 'uploads/user-a/draft-a/photo.png',
          moderation_state: 'pending',
          approved_at: null,
          print_asset_key: null,
          qr_metadata: {},
          created_at: '2026-07-22T12:00:01.000Z',
        },
      ],
    });

    await expect(
      service.getCardDraft('user-a', 'draft-a'),
    ).resolves.toMatchObject({
      assets: [
        {
          id: 'asset-mock',
          mockUrl: 'mock://souvenote/mock/generation/job-a/card-image.png',
        },
        {
          id: 'asset-s3',
          mockUrl: null,
          readUrl: 'https://private.s3.example/asset?signature=test',
        },
      ],
    });
  });

  it('atomically records approval for owned moderation-cleared generated assets', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 'asset-image',
          user_id: 'user-a',
          card_draft_id: 'draft-a',
          generation_job_id: 'job-a',
          asset_type: 'image',
          s3_key: 'mock/generation/job-a/card-image.png',
          moderation_state: 'approved_mock',
          approved_at: '2026-07-22T12:05:00.000Z',
          print_asset_key: null,
          qr_metadata: {},
          created_at: '2026-07-22T12:00:00.000Z',
        },
        {
          id: 'asset-message',
          user_id: 'user-a',
          card_draft_id: 'draft-a',
          generation_job_id: 'job-a',
          asset_type: 'message',
          s3_key: 'mock/generation/job-a/message.txt',
          moderation_state: 'approved_mock',
          approved_at: '2026-07-22T12:05:00.000Z',
          print_asset_key: null,
          qr_metadata: { text: 'Happy birthday!' },
          created_at: '2026-07-22T12:00:01.000Z',
        },
      ],
    });

    await expect(
      service.approveCardDraftAssets('user-a', 'draft-a', [
        'asset-image',
        'asset-message',
      ]),
    ).resolves.toMatchObject({
      cardDraftId: 'draft-a',
      assets: [
        { id: 'asset-image', approvedAt: '2026-07-22T12:05:00.000Z' },
        { id: 'asset-message', approvedAt: '2026-07-22T12:05:00.000Z' },
      ],
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "asset.moderation_state IN ('approved', 'approved_mock')",
      ),
      ['user-a', 'draft-a', ['asset-image', 'asset-message']],
    );
    expect(generationApproved).toHaveBeenCalledWith('user-a', 'draft-a', {
      providerMode: 'unknown',
      assetCount: 2,
    });
  });

  it('rejects the whole approval request when any asset is ineligible', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      service.approveCardDraftAssets('user-a', 'draft-a', ['asset-pending']),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
