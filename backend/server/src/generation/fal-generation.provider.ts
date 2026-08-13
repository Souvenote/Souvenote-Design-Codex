import {
  BadGatewayException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createFalClient, type FalClient } from '@fal-ai/client';
import {
  type ProviderOperation,
  ProviderTelemetryService,
} from '../observability/provider-telemetry.service';
import type {
  GenerationAssetType,
  GenerationProvider,
  GenerationProviderPollRequest,
  GenerationProviderRequest,
  GenerationProviderResult,
  ProviderGeneratedAsset,
} from './generation.provider';
import {
  buildMyCardImagePrompt,
  isBuildMyCardCreativeBrief,
} from './build-my-card-image-prompt';
import {
  buildPersonalizeTemplateImagePrompt,
  isPersonalizeTemplateCreativeBrief,
} from './personalize-template-image-prompt';

export const FAL_CLIENT = Symbol('FAL_CLIENT');

type FalJobRef = {
  endpointId: string;
  requestId: string;
};

type FalProviderRefs = {
  image?: FalJobRef;
  song?: FalJobRef;
  message?: { text: string };
};

@Injectable()
export class FalGenerationProvider implements GenerationProvider {
  readonly mode = 'fal';
  readonly acceptsReferenceImages = true;

  constructor(
    @Inject(FAL_CLIENT) private readonly falClient: FalClient,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  async start(request: GenerationProviderRequest) {
    const refs: FalProviderRefs = {};
    const submitted: FalJobRef[] = [];

    try {
      if (request.assetTypes.includes('image')) {
        const endpointId = request.referenceImageUrls.length
          ? 'openai/gpt-image-2/edit'
          : 'fal-ai/gpt-image-2';
        const queued = await this.measure('generation_submit', () =>
          this.falClient.queue.submit(endpointId, {
            input: {
              prompt: this.imagePrompt(request.creativeBrief),
              ...(request.referenceImageUrls.length
                ? { image_urls: request.referenceImageUrls }
                : {}),
              image_size: this.imageSize(
                request.creativeBrief,
                request.referenceImageUrls.length > 0,
              ),
              quality: 'high',
              num_images: 1,
              output_format: 'png',
            },
          }),
        );
        refs.image = {
          endpointId,
          requestId: queued.request_id,
        };
        submitted.push(refs.image);
      }

      if (request.assetTypes.includes('song')) {
        const endpointId = 'fal-ai/lyria3';
        const queued = await this.measure('generation_submit', () =>
          this.falClient.queue.submit(endpointId, {
            input: { prompt: this.songPrompt(request.creativeBrief) },
          }),
        );
        refs.song = {
          endpointId,
          requestId: queued.request_id,
        };
        submitted.push(refs.song);
      }

      if (request.assetTypes.includes('message')) {
        refs.message = { text: this.messageText(request.creativeBrief) };
      }
    } catch (error) {
      await Promise.allSettled(
        submitted.map((job) =>
          this.measure('generation_cancel', () =>
            this.falClient.queue.cancel(job.endpointId, {
              requestId: job.requestId,
            }),
          ),
        ),
      );
      throw error;
    }

    if (!refs.image && !refs.song) {
      return {
        status: 'completed' as const,
        result: this.buildResult(request.assetTypes, refs, {}),
      };
    }

    return {
      status: 'queued' as const,
      providerJobRefs: refs,
    };
  }

  async poll(request: GenerationProviderPollRequest) {
    const refs = this.parseRefs(request.providerJobRefs);
    const remoteJobs = [refs.image, refs.song].filter((job): job is FalJobRef =>
      Boolean(job),
    );

    if (
      (request.assetTypes.includes('image') && !refs.image) ||
      (request.assetTypes.includes('song') && !refs.song) ||
      (request.assetTypes.includes('message') && !refs.message)
    ) {
      return {
        status: 'failed' as const,
        errorMessage: 'fal.ai generation references are incomplete.',
        providerJobRefs: request.providerJobRefs,
      };
    }

    const statuses = await Promise.all(
      remoteJobs.map((job) =>
        this.measure('generation_status', () =>
          this.falClient.queue.status(job.endpointId, {
            requestId: job.requestId,
            logs: false,
          }),
        ),
      ),
    );
    if (statuses.some((status) => status.status !== 'COMPLETED')) {
      return {
        status: 'pending' as const,
        providerJobRefs: request.providerJobRefs,
      };
    }

    try {
      const results: Record<string, unknown> = {};
      if (refs.image) {
        const response = await this.measure('generation_result', () =>
          this.falClient.queue.result(refs.image!.endpointId, {
            requestId: refs.image!.requestId,
          }),
        );
        results.image = response.data as unknown;
      }
      if (refs.song) {
        const response = await this.measure('generation_result', () =>
          this.falClient.queue.result(refs.song!.endpointId, {
            requestId: refs.song!.requestId,
          }),
        );
        results.song = response.data as unknown;
      }

      return {
        status: 'completed' as const,
        result: this.buildResult(request.assetTypes, refs, results),
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        errorMessage:
          error instanceof Error
            ? `fal.ai generation failed: ${error.message}`
            : 'fal.ai generation failed.',
        providerJobRefs: request.providerJobRefs,
      };
    }
  }

  private buildResult(
    assetTypes: GenerationAssetType[],
    refs: FalProviderRefs,
    results: Record<string, unknown>,
  ): GenerationProviderResult {
    const assets = assetTypes.map((assetType) =>
      this.buildAsset(assetType, refs, results),
    );

    return {
      providerMode: this.mode,
      providerJobRefs: refs,
      resultMetadata: {
        assetCount: assets.length,
        models: {
          ...(refs.image ? { image: refs.image.endpointId } : {}),
          ...(refs.song ? { song: refs.song.endpointId } : {}),
          ...(refs.message ? { message: 'souvenote_deterministic_v1' } : {}),
        },
      },
      assets,
    };
  }

  private buildAsset(
    assetType: GenerationAssetType,
    refs: FalProviderRefs,
    results: Record<string, unknown>,
  ): ProviderGeneratedAsset {
    if (assetType === 'message') {
      return {
        assetType,
        source: {
          kind: 'inline',
          data: refs.message?.text ?? '',
          contentType: 'text/plain',
        },
        metadata: {
          source: 'souvenote_deterministic_v1',
          text: refs.message?.text ?? '',
        },
      };
    }

    const file =
      assetType === 'image'
        ? this.imageFile(results.image)
        : this.audioFile(results.song);
    return {
      assetType,
      source: {
        kind: 'remote',
        url: file.url,
        ...(file.contentType ? { contentType: file.contentType } : {}),
      },
      metadata: {
        source: 'fal_generation',
        requestId:
          assetType === 'image' ? refs.image?.requestId : refs.song?.requestId,
      },
    };
  }

  private imageFile(value: unknown) {
    const record = this.asRecord(value);
    const images = record.images;
    if (!Array.isArray(images) || !images[0]) {
      throw new BadGatewayException('fal.ai returned no generated image.');
    }
    return this.fileValue(images[0], 'image/png');
  }

  private audioFile(value: unknown) {
    const record = this.asRecord(value);
    if (!record.audio) {
      throw new BadGatewayException('fal.ai returned no generated audio.');
    }
    return this.fileValue(record.audio, 'audio/mpeg');
  }

  private fileValue(value: unknown, fallbackContentType: string) {
    if (typeof value === 'string' && value.trim()) {
      return { url: value.trim(), contentType: fallbackContentType };
    }
    const record = this.asRecord(value);
    if (typeof record.url !== 'string' || !record.url.trim()) {
      throw new BadGatewayException('fal.ai returned an invalid asset file.');
    }
    return {
      url: record.url.trim(),
      contentType:
        typeof record.content_type === 'string' && record.content_type.trim()
          ? record.content_type.trim().toLowerCase()
          : fallbackContentType,
    };
  }

  private parseRefs(value: Record<string, unknown>): FalProviderRefs {
    const image = this.jobRef(value.image, [
      'fal-ai/gpt-image-2',
      'openai/gpt-image-2/edit',
    ]);
    const song = this.jobRef(value.song, ['fal-ai/lyria3']);
    const messageRecord = this.asRecord(value.message);
    const message =
      typeof messageRecord.text === 'string'
        ? { text: messageRecord.text }
        : undefined;
    return { image, song, message };
  }

  private jobRef(value: unknown, allowedEndpoints: string[]) {
    const record = this.asRecord(value);
    if (
      typeof record.endpointId !== 'string' ||
      typeof record.requestId !== 'string' ||
      !allowedEndpoints.includes(record.endpointId) ||
      !record.requestId.trim()
    ) {
      return undefined;
    }
    return {
      endpointId: record.endpointId,
      requestId: record.requestId,
    };
  }

  private imagePrompt(creativeBrief: Record<string, unknown>) {
    if (isBuildMyCardCreativeBrief(creativeBrief)) {
      return buildMyCardImagePrompt(creativeBrief);
    }
    if (isPersonalizeTemplateCreativeBrief(creativeBrief)) {
      return buildPersonalizeTemplateImagePrompt(creativeBrief);
    }

    return [
      'Create a premium portrait 5x7 greeting-card front. Preserve recognizable people from reference images when supplied. No watermark or brand logos.',
      `Souvenote creative brief: ${this.briefText(creativeBrief)}`,
    ].join('\n');
  }

  private imageSize(
    creativeBrief: Record<string, unknown>,
    hasReferenceImages: boolean,
  ) {
    if (isBuildMyCardCreativeBrief(creativeBrief)) {
      const basics = this.asRecord(creativeBrief.basics);
      return basics.orientation === 'landscape'
        ? { width: 2240, height: 1600 }
        : { width: 1600, height: 2240 };
    }
    if (isPersonalizeTemplateCreativeBrief(creativeBrief)) {
      return { width: 1600, height: 2240 };
    }

    return hasReferenceImages ? 'auto' : 'portrait_4_3';
  }

  private songPrompt(creativeBrief: Record<string, unknown>) {
    return [
      'Create a polished 30-second original greeting-card song. Do not imitate a living artist or copyrighted recording.',
      `Souvenote creative brief: ${this.briefText(creativeBrief)}`,
    ].join('\n');
  }

  private messageText(creativeBrief: Record<string, unknown>) {
    const candidates = [
      creativeBrief.insideMessage,
      this.asRecord(creativeBrief.message).insideMessage,
      creativeBrief.caption,
    ];
    const supplied = candidates.find(
      (value): value is string =>
        typeof value === 'string' && Boolean(value.trim()),
    );
    return (
      supplied?.trim() ||
      'Wishing you a day filled with warmth, joy, and memories worth keeping.'
    ).slice(0, 4000);
  }

  private briefText(creativeBrief: Record<string, unknown>) {
    return JSON.stringify(creativeBrief, (key, value: unknown) =>
      key === 'clientUploadId' ? undefined : value,
    ).slice(0, 8000);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private measure<T>(operation: ProviderOperation, action: () => Promise<T>) {
    return this.providerTelemetry
      ? this.providerTelemetry.measure('fal', operation, action)
      : action();
  }
}

export function createFalGenerationClient(configService: ConfigService) {
  return createFalClient({
    credentials: () => configService.get<string>('FAL_KEY')?.trim(),
  });
}
