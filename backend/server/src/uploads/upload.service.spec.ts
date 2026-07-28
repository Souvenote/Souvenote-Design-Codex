import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { UploadStorageService } from './upload-storage.service';
import { UploadService } from './upload.service';

const uploadRow = {
  id: 'upload-a',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  asset_id: null,
  filename: 'photo.png',
  mime_type: 'image/png',
  size_bytes: 1234,
  storage_key: 'uploads/user-a/draft-a/photo.png',
  mock_url: null,
  provider_mode: 's3',
  status: 'requested',
  attestation_accepted: false,
  upload_expires_at: '2026-07-22T12:15:00.000Z',
  verified_at: null,
  etag: null,
  uploaded_at: null,
  created_at: '2026-07-22T12:00:00.000Z',
  updated_at: '2026-07-22T12:00:00.000Z',
};

const assetRow = {
  id: 'asset-a',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  generation_job_id: null,
  asset_type: 'upload',
  s3_key: uploadRow.storage_key,
  moderation_state: 'pending',
  approved_at: null,
  print_asset_key: null,
  qr_metadata: { source: 's3_upload' },
  created_at: '2026-07-22T12:01:00.000Z',
};

describe('UploadService', () => {
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
  const getProviderMode = jest.fn();
  const getMaxUploadBytes = jest.fn();
  const getAllowedContentTypes = jest.fn();
  const createUploadTarget = jest.fn();
  const verifyUpload = jest.fn();
  const uploadStorageService = {
    getProviderMode,
    getMaxUploadBytes,
    getAllowedContentTypes,
    createUploadTarget,
    verifyUpload,
  } as unknown as UploadStorageService;
  const configService = {
    get: jest.fn(),
  } as unknown as ConfigService;
  const service = new UploadService(
    databaseService,
    uploadStorageService,
    configService,
  );

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
    getProviderMode.mockReset();
    getMaxUploadBytes.mockReset();
    getAllowedContentTypes.mockReset();
    createUploadTarget.mockReset();
    verifyUpload.mockReset();

    getProviderMode.mockReturnValue('s3');
    getMaxUploadBytes.mockReturnValue(10 * 1024 * 1024);
    getAllowedContentTypes.mockReturnValue(
      new Set(['image/jpeg', 'image/png', 'image/webp']),
    );
  });

  it('creates a provider-aware S3 upload request', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-a' }] })
      .mockResolvedValueOnce({ rows: [uploadRow] });
    createUploadTarget.mockResolvedValue({
      providerMode: 's3',
      uploadMethod: 'POST',
      uploadUrl: 'https://private-souvenote-assets.s3.amazonaws.com',
      formFields: { policy: 'signed-policy' },
      expiresAt: '2026-07-22T12:15:00.000Z',
    });

    await expect(
      service.requestUpload(
        'user-a',
        'draft-a',
        'photo.png',
        ' Image/PNG ',
        1234,
      ),
    ).resolves.toMatchObject({
      uploadRequest: {
        id: 'upload-a',
        providerMode: 's3',
        uploadMethod: 'POST',
        uploadUrl: 'https://private-souvenote-assets.s3.amazonaws.com',
        formFields: { policy: 'signed-policy' },
      },
    });

    expect(createUploadTarget).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png' }),
    );
  });

  it('rejects unsupported content types before signing', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'draft-a' }] });

    await expect(
      service.requestUpload(
        'user-a',
        'draft-a',
        'document.pdf',
        'application/pdf',
        1234,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createUploadTarget).not.toHaveBeenCalled();
  });

  it('verifies S3 metadata and creates one pending moderation asset', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'draft-a' }] })
      .mockResolvedValueOnce({ rows: [uploadRow] });
    verifyUpload.mockResolvedValue({
      contentLength: 1234,
      contentType: 'image/png',
      etag: 'etag-value',
    });
    transactionQuery
      .mockResolvedValueOnce({ rows: [uploadRow] })
      .mockResolvedValueOnce({ rows: [assetRow] })
      .mockResolvedValueOnce({ rows: [{ id: 'moderation-job-a' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...uploadRow,
            asset_id: 'asset-a',
            status: 'uploaded',
            verified_at: '2026-07-22T12:01:00.000Z',
            etag: 'etag-value',
            uploaded_at: '2026-07-22T12:01:00.000Z',
          },
        ],
      });

    await expect(
      service.commitUpload('user-a', 'draft-a', uploadRow.storage_key, true),
    ).resolves.toMatchObject({
      upload: {
        status: 'uploaded',
        providerMode: 's3',
        etag: 'etag-value',
      },
      asset: {
        id: 'asset-a',
        moderationState: 'pending',
        mockUrl: null,
      },
    });

    expect(verifyUpload).toHaveBeenCalledWith({
      providerMode: 's3',
      storageKey: uploadRow.storage_key,
      contentType: 'image/png',
      fileSize: 1234,
    });
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO asset_moderation_jobs'),
      [assetRow.id, assetRow.user_id, 'manual'],
    );
  });

  it('disables the mock shortcut when S3 mode is active', async () => {
    await expect(
      service.createMockUpload('user-a', {
        cardDraftId: 'draft-a',
        filename: 'photo.png',
        mimeType: 'image/png',
        size: 1234,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(query).not.toHaveBeenCalled();
  });
});
