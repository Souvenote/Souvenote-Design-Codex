import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreditsService } from '../credits/credits.service';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { GenerationProviderRegistry } from './generation-provider.registry';
import { GenerationAssetStorageService } from './generation-asset-storage.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import type {
  GeneratedAssetOutput,
  GenerationProvider,
  GenerationProviderResult,
} from './generation.provider';
import { GenerationService } from './generation.service';

const runningJob = {
  id: 'job-a',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  idempotency_key: 'generation-a',
  overall_status: 'running',
  image_status: 'running',
  song_status: 'skipped',
  message_status: 'running',
  provider_mode: 'mock',
  requested_assets: ['image', 'message'],
  provider_job_refs: {},
  result_metadata: {},
  credits_charged: 1,
  error_message: null,
  started_at: new Date().toISOString(),
  completed_at: null,
  failed_at: null,
  refunded_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const completedJob = {
  ...runningJob,
  overall_status: 'ready',
  image_status: 'ready',
  message_status: 'ready',
  provider_job_refs: { mockJobId: 'job-a' },
  result_metadata: { assetCount: 2 },
  completed_at: '2026-07-22T12:00:01.000Z',
  updated_at: '2026-07-22T12:00:01.000Z',
};

const falRunningJob = {
  ...runningJob,
  provider_mode: 'fal',
  provider_job_refs: {
    image: { endpointId: 'fal-ai/gpt-image-2', requestId: 'fal-image-a' },
    message: { text: 'Happy birthday!' },
  },
};

const refundedFalJob = {
  ...falRunningJob,
  overall_status: 'refunded',
  image_status: 'failed',
  message_status: 'failed',
  error_message: 'fal.ai generation failed.',
  failed_at: '2026-07-22T12:10:00.000Z',
  refunded_at: '2026-07-22T12:10:01.000Z',
};

const imageAsset = {
  id: 'asset-image',
  user_id: 'user-a',
  card_draft_id: 'draft-a',
  generation_job_id: 'job-a',
  asset_type: 'image',
  s3_key: 'mock/generation/job-a/card-image.png',
  moderation_state: 'approved_mock',
  approved_at: null,
  print_asset_key: null,
  qr_metadata: { source: 'mock_generation' },
  created_at: '2026-07-22T12:00:01.000Z',
};

const messageAsset = {
  ...imageAsset,
  id: 'asset-message',
  asset_type: 'message',
  s3_key: 'mock/generation/job-a/inside-message.txt',
  qr_metadata: { source: 'mock_generation', text: 'Happy birthday!' },
};

const mockProviderResult: GenerationProviderResult = {
  providerMode: 'mock',
  providerJobRefs: { mockJobId: 'job-a' },
  resultMetadata: { assetCount: 2 },
  assets: [
    {
      assetType: 'image',
      source: { kind: 'stored', storageKey: imageAsset.s3_key },
      metadata: imageAsset.qr_metadata,
    },
    {
      assetType: 'message',
      source: { kind: 'stored', storageKey: messageAsset.s3_key },
      metadata: messageAsset.qr_metadata,
    },
  ],
};

const falProviderResult: GenerationProviderResult = {
  providerMode: 'fal',
  providerJobRefs: falRunningJob.provider_job_refs,
  resultMetadata: { assetCount: 2 },
  assets: [
    {
      assetType: 'image',
      source: {
        kind: 'remote',
        url: 'https://v3b.fal.media/files/generated.png',
        contentType: 'image/png',
      },
      metadata: { source: 'fal_generation' },
    },
    {
      assetType: 'message',
      source: {
        kind: 'inline',
        data: 'Happy birthday!',
        contentType: 'text/plain',
      },
      metadata: { text: 'Happy birthday!' },
    },
  ],
};

const mockOutputs: GeneratedAssetOutput[] = [
  {
    assetType: 'image',
    storageKey: imageAsset.s3_key,
    moderationState: 'approved_mock',
    metadata: imageAsset.qr_metadata,
  },
  {
    assetType: 'message',
    storageKey: messageAsset.s3_key,
    moderationState: 'approved_mock',
    metadata: messageAsset.qr_metadata,
  },
];

describe('GenerationService', () => {
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

  const deduct = jest.fn();
  const refund = jest.fn();
  const findBalance = jest.fn();
  const creditsService = {
    deduct,
    refund,
    findBalance,
  } as unknown as CreditsService;

  const start = jest.fn();
  const poll = jest.fn();
  const mockProvider: GenerationProvider = {
    mode: 'mock',
    acceptsReferenceImages: false,
    start,
    poll,
  };
  const falProvider: GenerationProvider = {
    mode: 'fal',
    acceptsReferenceImages: true,
    start,
    poll,
  };
  const getActiveProvider = jest.fn<GenerationProvider, []>();
  const getProviderForMode = jest.fn<GenerationProvider, [string]>();
  const providerRegistry = {
    getActiveProvider,
    getProviderForMode,
  } as unknown as GenerationProviderRegistry;

  const materialize = jest.fn();
  const assetStorageService = {
    materialize,
  } as unknown as GenerationAssetStorageService;
  const createReadUrl = jest.fn();
  const uploadStorageService = {
    createReadUrl,
  } as unknown as UploadStorageService;

  const getConfig = jest.fn();
  const configService = { get: getConfig } as unknown as ConfigService;
  const generationStarted = jest.fn();
  const service = new GenerationService(
    databaseService,
    creditsService,
    providerRegistry,
    assetStorageService,
    uploadStorageService,
    configService,
    { generationStarted } as unknown as AnalyticsService,
  );

  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
    deduct.mockReset();
    refund.mockReset();
    findBalance.mockReset();
    start.mockReset();
    poll.mockReset();
    getActiveProvider.mockReset();
    getProviderForMode.mockReset();
    materialize.mockReset();
    createReadUrl.mockReset();
    getConfig.mockReset();
    generationStarted.mockReset().mockResolvedValue(undefined);

    getActiveProvider.mockReturnValue(mockProvider);
    getProviderForMode.mockImplementation((mode) =>
      mode === 'fal' ? falProvider : mockProvider,
    );
    start.mockResolvedValue({
      status: 'completed',
      result: mockProviderResult,
    });
    materialize.mockResolvedValue(mockOutputs);
    createReadUrl.mockResolvedValue(
      'https://souvenote.s3.example/reference.png?signature=test',
    );
    deduct.mockResolvedValue({
      ledgerEntry: { id: 'ledger-deduct' },
      balance: { userId: 'user-a', balance: 9 },
    });
    refund.mockResolvedValue({
      ledgerEntry: { id: 'ledger-refund' },
      balance: { userId: 'user-a', balance: 10 },
    });
    findBalance.mockResolvedValue({ userId: 'user-a', balance: 9 });
  });

  it('charges one credit and completes only image and message for a no-song draft', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [runningJob] })
      .mockResolvedValueOnce({ rows: [imageAsset, messageAsset] });
    transactionQuery
      .mockResolvedValueOnce({ rows: [runningJob] })
      .mockResolvedValueOnce({ rows: [imageAsset] })
      .mockResolvedValueOnce({ rows: [messageAsset] })
      .mockResolvedValueOnce({ rows: [completedJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'ready', credits_charged: 1 },
      savedAssets: [{ asset_type: 'image' }, { asset_type: 'message' }],
      idempotentReplay: false,
    });

    expect(deduct).toHaveBeenCalledWith(
      'user-a',
      1,
      'generation:mock',
      'generation:user-a:generation-a:deduct',
    );
    expect(generationStarted).toHaveBeenCalledWith('user-a', 'job-a', {
      providerMode: 'mock',
      assetCount: 2,
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        assetTypes: ['image', 'message'],
        referenceImageUrls: [],
      }),
    );
    expect(materialize).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMode: 'mock',
        result: mockProviderResult,
      }),
    );
    expect(transactionQuery).toHaveBeenCalledTimes(5);
  });

  it('returns an idempotent replay without charging or generating again', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [completedJob] })
      .mockResolvedValueOnce({ rows: [imageAsset, messageAsset] });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).resolves.toMatchObject({
      generationJob: { id: 'job-a', overall_status: 'ready' },
      idempotentReplay: true,
    });

    expect(getActiveProvider).not.toHaveBeenCalled();
    expect(deduct).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('rejects reuse of an idempotency key for another asset set', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: true } }],
      })
      .mockResolvedValueOnce({ rows: [completedJob] });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
        assetTypes: ['song'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(deduct).not.toHaveBeenCalled();
  });

  it('marks a provider start failure and refunds the exact charge', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [runningJob] })
      .mockResolvedValueOnce({ rows: [{ id: 'job-a' }] })
      .mockResolvedValueOnce({ rows: [] });
    start.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(refund).toHaveBeenCalledWith(
      'user-a',
      1,
      'generation_failed',
      'generation:user-a:generation-a:refund',
    );
  });

  it('does not refund a completed job when building the response fails', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [runningJob] })
      .mockRejectedValueOnce(new Error('asset read unavailable'));
    transactionQuery
      .mockResolvedValueOnce({ rows: [runningJob] })
      .mockResolvedValueOnce({ rows: [imageAsset] })
      .mockResolvedValueOnce({ rows: [messageAsset] })
      .mockResolvedValueOnce({ rows: [completedJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).rejects.toThrow('asset read unavailable');

    expect(refund).not.toHaveBeenCalled();
  });

  it('queues Fal generation with short-lived URLs for owned reference uploads', async () => {
    const queuedJob = {
      ...falRunningJob,
      provider_job_refs: falRunningJob.provider_job_refs,
    };
    getActiveProvider.mockReturnValue(falProvider);
    start.mockResolvedValue({
      status: 'queued',
      providerJobRefs: falRunningJob.provider_job_refs,
    });
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            s3_key: 'uploads/user-a/photo.png',
            moderation_state: 'approved',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({ rows: [queuedJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'running', provider_mode: 'fal' },
      savedAssets: [],
    });

    expect(createReadUrl).toHaveBeenCalledWith('uploads/user-a/photo.png', {
      expiresInSetting: 'GENERATION_REFERENCE_URL_EXPIRES_SECONDS',
      defaultExpiresIn: 900,
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImageUrls: [
          'https://souvenote.s3.example/reference.png?signature=test',
        ],
      }),
    );
    expect(materialize).not.toHaveBeenCalled();
  });

  it('blocks pending reference uploads before charging credits or creating a job', async () => {
    getActiveProvider.mockReturnValue(falProvider);
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            s3_key: 'uploads/user-a/pending.png',
            moderation_state: 'pending',
          },
        ],
      });

    await expect(
      service.startGeneration('user-a', {
        cardDraftId: 'draft-a',
        idempotencyKey: 'generation-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(deduct).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(createReadUrl).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('keeps a queued Fal job running while the provider is pending', async () => {
    poll.mockResolvedValue({
      status: 'pending',
      providerJobRefs: falRunningJob.provider_job_refs,
    });
    query
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getGeneration('user-a', 'job-a'),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'running' },
      savedAssets: [],
    });

    expect(poll).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceImageUrls: [],
        providerJobRefs: falRunningJob.provider_job_refs,
      }),
    );
  });

  it('materializes and commits completed Fal outputs during status polling', async () => {
    const falImageAsset = {
      ...imageAsset,
      s3_key: 'generated/user-a/draft-a/job-a/image.png',
      moderation_state: 'pending',
    };
    const falMessageAsset = {
      ...messageAsset,
      s3_key: 'generated/user-a/draft-a/job-a/message.txt',
      moderation_state: 'approved',
    };
    const falCompletedJob = {
      ...completedJob,
      provider_mode: 'fal',
      provider_job_refs: falRunningJob.provider_job_refs,
    };
    poll.mockResolvedValue({ status: 'completed', result: falProviderResult });
    materialize.mockResolvedValue([
      {
        assetType: 'image',
        storageKey: falImageAsset.s3_key,
        moderationState: 'pending',
        metadata: { source: 'fal_generation' },
      },
      {
        assetType: 'message',
        storageKey: falMessageAsset.s3_key,
        moderationState: 'approved',
        metadata: { text: 'Happy birthday!' },
      },
    ]);
    query
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [falImageAsset, falMessageAsset] });
    transactionQuery
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({ rows: [falImageAsset] })
      .mockResolvedValueOnce({ rows: [{ id: 'moderation-job-a' }] })
      .mockResolvedValueOnce({ rows: [falMessageAsset] })
      .mockResolvedValueOnce({ rows: [falCompletedJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getGeneration('user-a', 'job-a'),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'ready', provider_mode: 'fal' },
      savedAssets: [
        { s3_key: 'generated/user-a/draft-a/job-a/image.png' },
        { s3_key: 'generated/user-a/draft-a/job-a/message.txt' },
      ],
    });

    expect(materialize).toHaveBeenCalledWith(
      expect.objectContaining({ result: falProviderResult }),
    );
    expect(refund).not.toHaveBeenCalled();
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO asset_moderation_jobs'),
      [falImageAsset.id, falImageAsset.user_id, 'manual'],
    );
  });

  it('fails and refunds a queued job when Fal reports failure', async () => {
    poll.mockResolvedValue({
      status: 'failed',
      errorMessage: 'fal.ai generation failed.',
      providerJobRefs: falRunningJob.provider_job_refs,
    });
    query
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'job-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [refundedFalJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getGeneration('user-a', 'job-a'),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'refunded' },
    });

    expect(refund).toHaveBeenCalledWith(
      'user-a',
      1,
      'generation_failed',
      'generation:user-a:generation-a:refund',
    );
  });

  it('times out and refunds a stale queued job without polling the provider', async () => {
    const staleJob = {
      ...falRunningJob,
      started_at: '2020-01-01T00:00:00.000Z',
      created_at: '2020-01-01T00:00:00.000Z',
    };
    query
      .mockResolvedValueOnce({ rows: [staleJob] })
      .mockResolvedValueOnce({ rows: [{ id: 'job-a' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [refundedFalJob] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getGeneration('user-a', 'job-a'),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'refunded' },
    });

    expect(poll).not.toHaveBeenCalled();
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it('does not refund when a competing poller has already completed the job', async () => {
    const falCompletedJob = {
      ...completedJob,
      provider_mode: 'fal',
      provider_job_refs: falRunningJob.provider_job_refs,
    };
    poll.mockResolvedValue({ status: 'completed', result: falProviderResult });
    materialize.mockRejectedValue(new Error('output import failed'));
    query
      .mockResolvedValueOnce({ rows: [falRunningJob] })
      .mockResolvedValueOnce({
        rows: [{ id: 'draft-a', creative_brief: { includeSong: false } }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [falCompletedJob] })
      .mockResolvedValueOnce({ rows: [falCompletedJob] })
      .mockResolvedValueOnce({ rows: [imageAsset, messageAsset] });

    await expect(
      service.getGeneration('user-a', 'job-a'),
    ).resolves.toMatchObject({
      generationJob: { overall_status: 'ready' },
    });

    expect(refund).not.toHaveBeenCalled();
  });

  it('does not expose a generation job owned by another user', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      service.getGeneration('user-b', 'job-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
