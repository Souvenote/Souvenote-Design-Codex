import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from '../uploads/upload-storage.service';
import { ProviderTelemetryService } from '../observability/provider-telemetry.service';
import type {
  GeneratedAssetOutput,
  GenerationAssetType,
  GenerationProviderResult,
  ProviderGeneratedAsset,
} from './generation.provider';

export const GENERATION_FETCH = Symbol('GENERATION_FETCH');

export type GenerationFetch = typeof fetch;

type MaterializeInput = {
  userId: string;
  cardDraftId: string;
  generationJobId: string;
  providerMode: string;
  result: GenerationProviderResult;
};

@Injectable()
export class GenerationAssetStorageService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    @Inject(GENERATION_FETCH) private readonly fetchAsset: GenerationFetch,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  async materialize(input: MaterializeInput) {
    return Promise.all(
      input.result.assets.map((asset) => this.materializeAsset(input, asset)),
    );
  }

  private async materializeAsset(
    input: MaterializeInput,
    asset: ProviderGeneratedAsset,
  ): Promise<GeneratedAssetOutput> {
    if (asset.source.kind === 'stored') {
      if (!asset.source.storageKey.startsWith('mock/')) {
        throw new InternalServerErrorException(
          'A stored provider asset must use an owned mock key.',
        );
      }
      return {
        assetType: asset.assetType,
        storageKey: asset.source.storageKey,
        moderationState: 'approved_mock',
        metadata: asset.metadata,
      };
    }

    const downloaded =
      asset.source.kind === 'remote'
        ? await this.downloadRemoteAsset(
            asset.source.url,
            asset.assetType,
            asset.source.contentType,
          )
        : null;
    const contentType =
      downloaded?.contentType ??
      this.resolveContentType(
        asset.assetType,
        asset.source.kind === 'inline' ? asset.source.contentType : undefined,
      );
    const data =
      asset.source.kind === 'inline'
        ? Buffer.from(asset.source.data, 'utf8')
        : downloaded?.data;
    if (!data) {
      throw new BadGatewayException(
        `The generated ${asset.assetType} asset was empty.`,
      );
    }
    this.assertAssetSize(asset.assetType, data.byteLength);

    const extension = this.extensionFor(contentType);
    const storageKey = `generated/${input.userId}/${input.cardDraftId}/${input.generationJobId}/${asset.assetType}.${extension}`;
    const { bucket } = this.getS3Configuration();
    const kmsKeyId = this.configService
      .get<string>('AWS_S3_KMS_KEY_ID')
      ?.trim();

    const put = () =>
      this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: data,
          ContentType: contentType,
          ServerSideEncryption: kmsKeyId ? 'aws:kms' : 'AES256',
          ...(kmsKeyId ? { SSEKMSKeyId: kmsKeyId } : {}),
          Metadata: {
            generationjobid: input.generationJobId,
            providermode: input.providerMode,
            assettype: asset.assetType,
          },
        }),
      );
    await (this.providerTelemetry
      ? this.providerTelemetry.measure('s3', 's3_put', put)
      : put());

    return {
      assetType: asset.assetType,
      storageKey,
      moderationState: asset.assetType === 'message' ? 'approved' : 'pending',
      metadata: {
        ...asset.metadata,
        providerMode: input.providerMode,
        contentType,
        sizeBytes: data.byteLength,
      },
    };
  }

  private async downloadRemoteAsset(
    sourceUrl: string,
    assetType: GenerationAssetType,
    declaredContentType?: string,
  ) {
    const parsed = this.assertTrustedRemoteUrl(sourceUrl);
    const timeoutMs = this.readInteger(
      'GENERATION_ASSET_DOWNLOAD_TIMEOUT_MS',
      30000,
      1000,
      120000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const download = () =>
        this.fetchAsset(parsed, {
          method: 'GET',
          redirect: 'error',
          signal: controller.signal,
        });
      const response = await (this.providerTelemetry
        ? this.providerTelemetry.measureHttp('fal', 'asset_download', download)
        : download());

      if (!response.ok) {
        throw new BadGatewayException(
          `The generated ${assetType} asset returned status ${response.status}.`,
        );
      }

      const contentType = this.resolveContentType(
        assetType,
        declaredContentType,
        response.headers.get('content-type') ?? undefined,
      );
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > 0) {
        this.assertAssetSize(assetType, contentLength);
      }

      const data = await this.readResponseBody(response, assetType);
      this.assertFileSignature(assetType, contentType, data);
      return { data, contentType };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(
        `The generated ${assetType} asset could not be downloaded.`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponseBody(
    response: Response,
    assetType: GenerationAssetType,
  ) {
    if (!response.body) {
      throw new BadGatewayException(
        `The generated ${assetType} asset was empty.`,
      );
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        this.assertAssetSize(assetType, totalBytes);
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }

    this.assertAssetSize(assetType, totalBytes);
    return Buffer.concat(chunks, totalBytes);
  }

  private assertTrustedRemoteUrl(sourceUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new BadGatewayException(
        'The generation provider returned an invalid asset URL.',
      );
    }

    const allowedHosts = (
      this.configService.get<string>('GENERATION_REMOTE_ASSET_HOSTS') ??
      'fal.media'
    )
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const hostname = parsed.hostname.toLowerCase();
    const trusted = allowedHosts.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (
      parsed.protocol !== 'https:' ||
      !trusted ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== '443')
    ) {
      throw new BadGatewayException(
        'The generation provider returned an untrusted asset URL.',
      );
    }

    return parsed;
  }

  private resolveContentType(
    assetType: GenerationAssetType,
    sourceContentType?: string,
    downloadedContentType?: string,
  ) {
    const declared = this.normalizeContentType(sourceContentType);
    const downloaded = this.normalizeContentType(downloadedContentType);
    if (declared && downloaded && declared !== downloaded) {
      throw new BadGatewayException(
        `The generated ${assetType} content type did not match its download.`,
      );
    }

    const contentType = declared || downloaded;
    const allowed = {
      image: new Set(['image/png', 'image/jpeg', 'image/webp']),
      song: new Set(['audio/mpeg']),
      message: new Set(['text/plain']),
    }[assetType];

    if (!allowed.has(contentType)) {
      throw new BadGatewayException(
        `The generation provider returned an unsupported ${assetType} content type.`,
      );
    }

    return contentType;
  }

  private normalizeContentType(contentType?: string) {
    return (contentType ?? '').split(';')[0].trim().toLowerCase();
  }

  private assertFileSignature(
    assetType: GenerationAssetType,
    contentType: string,
    data: Buffer,
  ) {
    if (assetType === 'message') return;

    const valid = {
      'image/png':
        data.length >= 8 &&
        data
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ),
      'image/jpeg':
        data.length >= 3 &&
        data[0] === 0xff &&
        data[1] === 0xd8 &&
        data[2] === 0xff,
      'image/webp':
        data.length >= 12 &&
        data.subarray(0, 4).toString('ascii') === 'RIFF' &&
        data.subarray(8, 12).toString('ascii') === 'WEBP',
      'audio/mpeg':
        (data.length >= 3 && data.subarray(0, 3).toString('ascii') === 'ID3') ||
        (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0),
    }[contentType];

    if (!valid) {
      throw new BadGatewayException(
        `The generated ${assetType} file signature was invalid.`,
      );
    }
  }

  private assertAssetSize(assetType: GenerationAssetType, size: number) {
    const maximum = {
      image: this.readInteger(
        'GENERATION_MAX_IMAGE_BYTES',
        20 * 1024 * 1024,
        1,
        50 * 1024 * 1024,
      ),
      song: this.readInteger(
        'GENERATION_MAX_AUDIO_BYTES',
        20 * 1024 * 1024,
        1,
        50 * 1024 * 1024,
      ),
      message: 100 * 1024,
    }[assetType];

    if (!Number.isInteger(size) || size <= 0 || size > maximum) {
      throw new BadGatewayException(
        `The generated ${assetType} asset exceeds the allowed size.`,
      );
    }
  }

  private extensionFor(contentType: string) {
    return {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'text/plain': 'txt',
    }[contentType] as string;
  }

  private getS3Configuration() {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME')?.trim();
    const region = this.configService.get<string>('AWS_REGION')?.trim();
    if (!bucket || !region) {
      throw new InternalServerErrorException(
        'AWS_REGION and AWS_S3_BUCKET_NAME are required for real generation assets.',
      );
    }
    return { bucket, region };
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
}

export const defaultGenerationFetch: GenerationFetch = fetch;
