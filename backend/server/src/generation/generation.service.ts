import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
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
import {
  enqueuePendingModerationJob,
  resolveModerationProviderMode,
} from '../moderation/moderation-queue';
import type { StartGenerationDto } from './generation.controller';
import type {
  GeneratedAssetOutput,
  GenerationAssetType,
  GenerationProvider,
  GenerationProviderResult,
} from './generation.provider';

type CardDraftRow = {
  id: string;
  creative_brief: Record<string, unknown> | null;
};

type GenerationJobRow = {
  id: string;
  user_id: string;
  card_draft_id: string;
  idempotency_key: string;
  overall_status: string;
  image_status: string;
  song_status: string;
  message_status: string;
  provider_mode: string;
  requested_assets: GenerationAssetType[];
  provider_job_refs: Record<string, unknown>;
  result_metadata: Record<string, unknown>;
  credits_charged: number;
  error_message: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  failed_at: Date | string | null;
  refunded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type AssetRow = {
  id: string;
  user_id: string;
  card_draft_id: string | null;
  generation_job_id: string | null;
  asset_type: string;
  s3_key: string | null;
  moderation_state: string | null;
  approved_at: Date | string | null;
  print_asset_key: string | null;
  qr_metadata: Record<string, unknown> | null;
  created_at: Date | string;
};

type CreditDeduction = Awaited<ReturnType<CreditsService['deduct']>>;

@Injectable()
export class GenerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly creditsService: CreditsService,
    private readonly providerRegistry: GenerationProviderRegistry,
    private readonly assetStorageService: GenerationAssetStorageService,
    private readonly uploadStorageService: UploadStorageService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly analyticsService?: AnalyticsService,
  ) {}

  async startGeneration(userId: string, dto: StartGenerationDto) {
    const draft = await this.findOwnedDraft(userId, dto.cardDraftId);
    const requestedAssets = this.resolveRequestedAssets(draft, dto.assetTypes);
    const existing = await this.findJobByIdempotencyKey(
      userId,
      dto.idempotencyKey,
    );

    if (existing) {
      this.assertIdempotentRequest(existing, dto.cardDraftId, requestedAssets);
      return this.buildResponse(existing, null, true);
    }

    const provider = this.providerRegistry.getActiveProvider();
    const referenceImageUrls = provider.acceptsReferenceImages
      ? await this.findReferenceImageUrls(userId, dto.cardDraftId)
      : [];
    const generationCost = this.calculateCost(requestedAssets);
    const deductionKey = this.creditKey(userId, dto.idempotencyKey, 'deduct');
    let deduction: CreditDeduction | null = null;
    let generationJob: GenerationJobRow | undefined;
    let generationWorkSucceeded = false;

    try {
      if (generationCost > 0) {
        deduction = await this.creditsService.deduct(
          userId,
          generationCost,
          `generation:${provider.mode}`,
          deductionKey,
        );
      }

      const inserted = await this.insertGenerationJob(
        userId,
        dto.cardDraftId,
        dto.idempotencyKey,
        requestedAssets,
        generationCost,
        provider.mode,
      );

      if (!inserted) {
        const racedJob = await this.findJobByIdempotencyKey(
          userId,
          dto.idempotencyKey,
        );
        if (!racedJob) {
          throw new ConflictException(
            'The generation idempotency key could not be resolved.',
          );
        }
        this.assertIdempotentRequest(
          racedJob,
          dto.cardDraftId,
          requestedAssets,
        );
        generationWorkSucceeded = true;
        return this.buildResponse(racedJob, deduction, true);
      }

      generationJob = inserted;
      this.analyticsService?.generationStarted(userId, generationJob.id, {
        providerMode: provider.mode,
        assetCount: requestedAssets.length,
      });
      const providerRequest = this.createProviderRequest(
        generationJob,
        draft,
        requestedAssets,
        referenceImageUrls,
      );
      const providerStart = await provider.start(providerRequest);

      if (providerStart.status === 'queued') {
        const queuedJob = await this.updateProviderJobRefs(
          generationJob,
          providerStart.providerJobRefs,
        );
        generationWorkSucceeded = true;
        return this.buildResponse(queuedJob, deduction, false);
      }

      const completed = await this.finalizeProviderResult(
        generationJob,
        provider,
        providerStart.result,
      );
      generationWorkSucceeded = true;
      return this.buildResponse(completed, deduction, false);
    } catch (error) {
      if (generationWorkSucceeded) {
        throw error;
      }
      if (!deduction && !generationJob) {
        throw error;
      }

      await this.failAndRefund(
        userId,
        dto.idempotencyKey,
        generationJob,
        generationCost,
        error,
      );
      throw new BadRequestException(
        'Generation failed. Eligible credits were refunded.',
      );
    }
  }

  async getGeneration(userId: string, generationJobId: string) {
    let generationJob = await this.findOwnedJob(userId, generationJobId);
    if (!generationJob) {
      throw new NotFoundException('Generation job not found.');
    }

    if (generationJob.overall_status === 'running') {
      generationJob = await this.refreshRunningGeneration(generationJob);
    }

    return this.buildResponse(generationJob, null, true);
  }

  private createProviderRequest(
    generationJob: GenerationJobRow,
    draft: CardDraftRow,
    assetTypes: GenerationAssetType[],
    referenceImageUrls: string[],
  ) {
    return {
      generationJobId: generationJob.id,
      cardDraftId: generationJob.card_draft_id,
      creativeBrief: draft.creative_brief ?? {},
      assetTypes,
      referenceImageUrls,
    };
  }

  private async findReferenceImageUrls(userId: string, cardDraftId: string) {
    const result = await this.databaseService.query<{
      s3_key: string;
      moderation_state: string;
    }>(
      `
        SELECT s3_key, moderation_state
        FROM assets
        WHERE user_id = $1
          AND card_draft_id = $2
          AND asset_type = 'upload'
          AND s3_key IS NOT NULL
        ORDER BY created_at ASC
        LIMIT 16;
      `,
      [userId, cardDraftId],
    );

    if (
      result.rows.some((asset) =>
        ['rejected', 'failed'].includes(asset.moderation_state),
      )
    ) {
      throw new BadRequestException(
        'A reference image was rejected by moderation. Remove or replace it before generating.',
      );
    }

    if (
      result.rows.some(
        (asset) =>
          !['approved', 'approved_mock'].includes(asset.moderation_state),
      )
    ) {
      throw new ConflictException(
        'Reference images are still being reviewed. Try generation after moderation is complete.',
      );
    }

    const urls = await Promise.all(
      result.rows.map((asset) =>
        this.uploadStorageService.createReadUrl(asset.s3_key, {
          expiresInSetting: 'GENERATION_REFERENCE_URL_EXPIRES_SECONDS',
          defaultExpiresIn: 900,
        }),
      ),
    );
    if (urls.some((url) => !url)) {
      throw new BadRequestException(
        'A reference image is unavailable to the generation provider. Upload it again before generating.',
      );
    }

    return urls as string[];
  }

  private async refreshRunningGeneration(generationJob: GenerationJobRow) {
    if (this.isTimedOut(generationJob)) {
      await this.failAndRefund(
        generationJob.user_id,
        generationJob.idempotency_key,
        generationJob,
        generationJob.credits_charged,
        new Error('Generation provider timed out.'),
      );
      return this.reloadJob(generationJob);
    }

    const provider = this.providerRegistry.getProviderForMode(
      generationJob.provider_mode,
    );
    const draft = await this.findOwnedDraft(
      generationJob.user_id,
      generationJob.card_draft_id,
    );
    const providerRequest = this.createProviderRequest(
      generationJob,
      draft,
      this.canonicalAssetTypes(generationJob.requested_assets),
      [],
    );
    const poll = await provider.poll({
      ...providerRequest,
      providerJobRefs: generationJob.provider_job_refs ?? {},
    });

    if (poll.status === 'pending') {
      return this.updateProviderJobRefs(generationJob, poll.providerJobRefs);
    }

    if (poll.status === 'failed') {
      await this.failAndRefund(
        generationJob.user_id,
        generationJob.idempotency_key,
        generationJob,
        generationJob.credits_charged,
        new Error(poll.errorMessage),
      );
      return this.reloadJob(generationJob);
    }

    try {
      return await this.finalizeProviderResult(
        generationJob,
        provider,
        poll.result,
      );
    } catch (error) {
      await this.failAndRefund(
        generationJob.user_id,
        generationJob.idempotency_key,
        generationJob,
        generationJob.credits_charged,
        error,
      );
      return this.reloadJob(generationJob);
    }
  }

  private async finalizeProviderResult(
    generationJob: GenerationJobRow,
    provider: GenerationProvider,
    result: GenerationProviderResult,
  ) {
    const requestedAssets = this.canonicalAssetTypes(
      generationJob.requested_assets,
    );
    this.validateProviderResult(provider, requestedAssets, result);
    const outputs = await this.assetStorageService.materialize({
      userId: generationJob.user_id,
      cardDraftId: generationJob.card_draft_id,
      generationJobId: generationJob.id,
      providerMode: provider.mode,
      result,
    });
    this.validateMaterializedOutputs(requestedAssets, outputs);
    return this.completeGeneration(generationJob, result, outputs);
  }

  private async updateProviderJobRefs(
    generationJob: GenerationJobRow,
    providerJobRefs: Record<string, unknown>,
  ) {
    const result = await this.databaseService.query<GenerationJobRow>(
      `
        UPDATE generation_jobs
        SET provider_job_refs = $3::jsonb, updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND overall_status = 'running'
        RETURNING ${this.generationJobColumns};
      `,
      [
        generationJob.id,
        generationJob.user_id,
        JSON.stringify(providerJobRefs),
      ],
    );
    return result.rows[0] ?? this.reloadJob(generationJob);
  }

  private async reloadJob(generationJob: GenerationJobRow) {
    const reloaded = await this.findOwnedJob(
      generationJob.user_id,
      generationJob.id,
    );
    if (!reloaded) {
      throw new NotFoundException('Generation job not found.');
    }
    return reloaded;
  }

  private isTimedOut(generationJob: GenerationJobRow) {
    const startedAt = generationJob.started_at
      ? new Date(generationJob.started_at).getTime()
      : new Date(generationJob.created_at).getTime();
    const timeoutSeconds = this.readInteger(
      'GENERATION_JOB_TIMEOUT_SECONDS',
      1800,
      60,
      86400,
    );
    return (
      !Number.isFinite(startedAt) ||
      Date.now() - startedAt > timeoutSeconds * 1000
    );
  }

  private async findOwnedDraft(userId: string, cardDraftId: string) {
    const result = await this.databaseService.query<CardDraftRow>(
      `
        SELECT id, creative_brief
        FROM card_drafts
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL;
      `,
      [cardDraftId, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Card draft not found.');
    }

    return result.rows[0];
  }

  private async findJobByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ) {
    const result = await this.databaseService.query<GenerationJobRow>(
      `
        SELECT ${this.generationJobColumns}
        FROM generation_jobs
        WHERE user_id = $1
          AND idempotency_key = $2;
      `,
      [userId, idempotencyKey],
    );

    return result.rows[0];
  }

  private async findOwnedJob(userId: string, generationJobId: string) {
    const result = await this.databaseService.query<GenerationJobRow>(
      `
        SELECT ${this.generationJobColumns}
        FROM generation_jobs
        WHERE id = $1
          AND user_id = $2;
      `,
      [generationJobId, userId],
    );

    return result.rows[0];
  }

  private async insertGenerationJob(
    userId: string,
    cardDraftId: string,
    idempotencyKey: string,
    requestedAssets: GenerationAssetType[],
    generationCost: number,
    providerMode: string,
  ) {
    const requested = new Set(requestedAssets);
    const result = await this.databaseService.query<GenerationJobRow>(
      `
        INSERT INTO generation_jobs (
          user_id,
          card_draft_id,
          idempotency_key,
          overall_status,
          image_status,
          song_status,
          message_status,
          provider_mode,
          requested_assets,
          credits_charged,
          started_at
        )
        VALUES ($1, $2, $3, 'running', $4, $5, $6, $7, $8::jsonb, $9, NOW())
        ON CONFLICT (user_id, idempotency_key) DO NOTHING
        RETURNING ${this.generationJobColumns};
      `,
      [
        userId,
        cardDraftId,
        idempotencyKey,
        requested.has('image') ? 'running' : 'skipped',
        requested.has('song') ? 'running' : 'skipped',
        requested.has('message') ? 'running' : 'skipped',
        providerMode,
        JSON.stringify(requestedAssets),
        generationCost,
      ],
    );

    return result.rows[0];
  }

  private async completeGeneration(
    generationJob: GenerationJobRow,
    providerResult: GenerationProviderResult,
    outputs: GeneratedAssetOutput[],
  ) {
    return this.databaseService.withTransaction(async (transaction) => {
      const locked = await transaction.query<GenerationJobRow>(
        `
          SELECT ${this.generationJobColumns}
          FROM generation_jobs
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE;
        `,
        [generationJob.id, generationJob.user_id],
      );
      const current = locked.rows[0];
      if (!current) {
        throw new NotFoundException('Generation job not found.');
      }

      if (current.overall_status === 'ready') {
        return current;
      }
      if (current.overall_status !== 'running') {
        throw new ConflictException(
          `Generation cannot complete from ${current.overall_status} status.`,
        );
      }

      for (const output of outputs) {
        await this.insertAsset(transaction, current, output);
      }

      const requested = new Set(current.requested_assets);
      const updated = await transaction.query<GenerationJobRow>(
        `
          UPDATE generation_jobs
          SET
            overall_status = 'ready',
            image_status = $3,
            song_status = $4,
            message_status = $5,
            provider_job_refs = $6::jsonb,
            result_metadata = $7::jsonb,
            error_message = NULL,
            completed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
          RETURNING ${this.generationJobColumns};
        `,
        [
          current.id,
          current.user_id,
          requested.has('image') ? 'ready' : 'skipped',
          requested.has('song') ? 'ready' : 'skipped',
          requested.has('message') ? 'ready' : 'skipped',
          JSON.stringify(providerResult.providerJobRefs),
          JSON.stringify(providerResult.resultMetadata),
        ],
      );

      await transaction.query(
        `
          UPDATE card_drafts
          SET status = 'generated', updated_at = NOW()
          WHERE id = $1
            AND user_id = $2;
        `,
        [current.card_draft_id, current.user_id],
      );

      return updated.rows[0];
    });
  }

  private async insertAsset(
    transaction: DatabaseTransaction,
    generationJob: GenerationJobRow,
    output: GeneratedAssetOutput,
  ) {
    const inserted = await transaction.query<AssetRow>(
      `
        INSERT INTO assets (
          user_id,
          card_draft_id,
          generation_job_id,
          asset_type,
          s3_key,
          moderation_state,
          qr_metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING ${this.assetColumns};
      `,
      [
        generationJob.user_id,
        generationJob.card_draft_id,
        generationJob.id,
        output.assetType,
        output.storageKey,
        output.moderationState,
        JSON.stringify(output.metadata),
      ],
    );

    const asset = inserted.rows[0];
    if (asset.moderation_state === 'pending') {
      await enqueuePendingModerationJob(
        transaction,
        asset,
        resolveModerationProviderMode(this.configService),
      );
    }
  }

  private async failAndRefund(
    userId: string,
    idempotencyKey: string,
    generationJob: GenerationJobRow | undefined,
    generationCost: number,
    error: unknown,
  ) {
    const errorMessage = this.errorMessage(error);
    let jobStatusUpdateFailed = false;
    let shouldRefund = !generationJob;

    if (generationJob) {
      try {
        const failed = await this.databaseService.query<{ id: string }>(
          `
            UPDATE generation_jobs
            SET
              overall_status = 'failed',
              image_status = CASE WHEN image_status = 'running' THEN 'failed' ELSE image_status END,
              song_status = CASE WHEN song_status = 'running' THEN 'failed' ELSE song_status END,
              message_status = CASE WHEN message_status = 'running' THEN 'failed' ELSE message_status END,
              error_message = $3,
              failed_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
              AND user_id = $2
              AND overall_status = 'running'
            RETURNING id;
          `,
          [generationJob.id, userId, errorMessage],
        );
        shouldRefund = Boolean(failed.rows[0]);

        if (!shouldRefund) {
          const current = await this.findOwnedJob(userId, generationJob.id);
          if (current?.overall_status === 'ready') {
            return;
          }
          shouldRefund = true;
        }
      } catch {
        jobStatusUpdateFailed = true;
        shouldRefund = true;
      }
    }

    if (generationCost === 0 || !shouldRefund) {
      if (jobStatusUpdateFailed) {
        throw new InternalServerErrorException(
          'Generation failed and its job status could not be updated.',
        );
      }
      return;
    }

    try {
      await this.creditsService.refund(
        userId,
        generationCost,
        'generation_failed',
        this.creditKey(userId, idempotencyKey, 'refund'),
      );
    } catch {
      throw new InternalServerErrorException(
        'Generation failed and the credit refund could not be confirmed.',
      );
    }

    if (generationJob) {
      try {
        await this.databaseService.query(
          `
            UPDATE generation_jobs
            SET overall_status = 'refunded', refunded_at = NOW(), updated_at = NOW()
            WHERE id = $1
              AND user_id = $2
              AND overall_status = 'failed';
          `,
          [generationJob.id, userId],
        );
      } catch {
        jobStatusUpdateFailed = true;
      }
    }

    if (jobStatusUpdateFailed) {
      throw new InternalServerErrorException(
        'Generation failed and credits were refunded, but its job status could not be updated.',
      );
    }
  }

  private async buildResponse(
    generationJob: GenerationJobRow,
    deduction: CreditDeduction | null,
    idempotentReplay: boolean,
  ) {
    const assets = await this.findAssetsForJob(
      generationJob.user_id,
      generationJob.id,
    );
    const balance = await this.creditsService.findBalance(
      generationJob.user_id,
    );

    return {
      generationJob,
      savedAssets: assets,
      mockAssets:
        generationJob.provider_mode === 'mock'
          ? this.toMockAssets(assets)
          : undefined,
      creditDeduction: deduction?.ledgerEntry ?? null,
      balance,
      idempotentReplay,
    };
  }

  private async findAssetsForJob(userId: string, generationJobId: string) {
    const result = await this.databaseService.query<AssetRow>(
      `
        SELECT ${this.assetColumns}
        FROM assets
        WHERE user_id = $1
          AND generation_job_id = $2
        ORDER BY created_at ASC;
      `,
      [userId, generationJobId],
    );

    return result.rows;
  }

  private resolveRequestedAssets(
    draft: CardDraftRow,
    requested?: GenerationAssetType[],
  ): GenerationAssetType[] {
    if (requested?.length) {
      const canonical = this.canonicalAssetTypes(requested);
      if (canonical.includes('song') && !this.draftIncludesSong(draft)) {
        throw new BadRequestException(
          'Song generation is not enabled for this card draft.',
        );
      }
      return canonical;
    }

    return this.canonicalAssetTypes([
      'image',
      'message',
      ...(this.draftIncludesSong(draft) ? (['song'] as const) : []),
    ]);
  }

  private draftIncludesSong(draft: CardDraftRow) {
    const brief = draft.creative_brief ?? {};
    if (typeof brief.includeSong === 'boolean') {
      return brief.includeSong;
    }

    const song = brief.song;
    if (song && typeof song === 'object' && !Array.isArray(song)) {
      const includeSong = (song as Record<string, unknown>).includeSong;
      if (typeof includeSong === 'boolean') {
        return includeSong;
      }
    }

    return true;
  }

  private canonicalAssetTypes(assetTypes: readonly GenerationAssetType[]) {
    const requested = new Set(assetTypes);
    return (['image', 'song', 'message'] as const).filter((assetType) =>
      requested.has(assetType),
    );
  }

  private calculateCost(assetTypes: GenerationAssetType[]) {
    return assetTypes.reduce(
      (total, assetType) =>
        total + (assetType === 'image' || assetType === 'song' ? 1 : 0),
      0,
    );
  }

  private assertIdempotentRequest(
    generationJob: GenerationJobRow,
    cardDraftId: string,
    requestedAssets: GenerationAssetType[],
  ) {
    const existingAssets = this.canonicalAssetTypes(
      Array.isArray(generationJob.requested_assets)
        ? generationJob.requested_assets
        : [],
    );

    if (
      generationJob.card_draft_id !== cardDraftId ||
      JSON.stringify(existingAssets) !== JSON.stringify(requestedAssets)
    ) {
      throw new ConflictException(
        'The generation idempotency key is already used by a different request.',
      );
    }
  }

  private validateProviderResult(
    provider: GenerationProvider,
    requestedAssets: GenerationAssetType[],
    result: GenerationProviderResult,
  ) {
    if (result.providerMode !== provider.mode) {
      throw new Error('Generation provider returned a mismatched mode.');
    }

    const outputTypes = result.assets.map((asset) => asset.assetType);
    if (
      new Set(outputTypes).size !== outputTypes.length ||
      JSON.stringify(this.canonicalAssetTypes(outputTypes)) !==
        JSON.stringify(requestedAssets)
    ) {
      throw new Error('Generation provider returned an invalid asset set.');
    }

    if (
      result.assets.some((asset) => {
        if (asset.source.kind === 'stored') {
          return (
            provider.mode !== 'mock' ||
            !asset.source.storageKey.startsWith('mock/')
          );
        }
        if (asset.source.kind === 'remote') {
          return provider.mode === 'mock' || !asset.source.url.trim();
        }
        return !asset.source.data.trim() || !asset.source.contentType.trim();
      })
    ) {
      throw new Error('Generation provider returned an invalid asset source.');
    }
  }

  private validateMaterializedOutputs(
    requestedAssets: GenerationAssetType[],
    outputs: GeneratedAssetOutput[],
  ) {
    const outputTypes = outputs.map((asset) => asset.assetType);
    if (
      new Set(outputTypes).size !== outputTypes.length ||
      JSON.stringify(this.canonicalAssetTypes(outputTypes)) !==
        JSON.stringify(requestedAssets) ||
      outputs.some(
        (asset) =>
          !asset.storageKey.trim() || asset.storageKey.trim().length > 255,
      )
    ) {
      throw new Error('Generated assets could not be materialized safely.');
    }
  }

  private toMockAssets(assets: AssetRow[]) {
    return Object.fromEntries(
      assets.map((asset) => [
        asset.asset_type,
        {
          status: 'ready',
          ...(asset.s3_key
            ? { mockUrl: `mock://souvenote/${asset.s3_key}` }
            : {}),
          ...(asset.asset_type === 'message' &&
          typeof asset.qr_metadata?.text === 'string'
            ? { text: asset.qr_metadata.text }
            : {}),
        },
      ]),
    );
  }

  private creditKey(
    userId: string,
    idempotencyKey: string,
    operation: 'deduct' | 'refund',
  ) {
    return `generation:${userId}:${idempotencyKey}:${operation}`;
  }

  private errorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return message.slice(0, 1000);
  }

  private readInteger(
    key: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(key);
    if (!configured) return fallback;
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new InternalServerErrorException(
        `${key} must be an integer between ${minimum} and ${maximum}.`,
      );
    }
    return value;
  }

  private get generationJobColumns() {
    return `
      id,
      user_id,
      card_draft_id,
      idempotency_key,
      overall_status,
      image_status,
      song_status,
      message_status,
      provider_mode,
      requested_assets,
      provider_job_refs,
      result_metadata,
      credits_charged,
      error_message,
      started_at,
      completed_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    `;
  }

  private get assetColumns() {
    return `
      id,
      user_id,
      card_draft_id,
      generation_job_id,
      asset_type,
      s3_key,
      moderation_state,
      approved_at,
      print_asset_key,
      qr_metadata,
      created_at
    `;
  }
}
