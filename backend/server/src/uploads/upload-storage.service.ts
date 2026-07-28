import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  createPresignedPost,
  type PresignedPost,
  type PresignedPostOptions,
} from '@aws-sdk/s3-presigned-post';
import { ProviderTelemetryService } from '../observability/provider-telemetry.service';

export const S3_CLIENT = Symbol('S3_CLIENT');
export const S3_PRESIGNED_POST = Symbol('S3_PRESIGNED_POST');
export const S3_GET_SIGNED_URL = Symbol('S3_GET_SIGNED_URL');

export type UploadProviderMode = 'mock' | 's3';
export type PresignedPostFactory = (
  client: S3Client,
  options: PresignedPostOptions,
) => Promise<PresignedPost>;
export type S3GetSignedUrlFactory = typeof getSignedUrl;

type ReadUrlOptions = {
  expiresInSetting?: string;
  defaultExpiresIn?: number;
};

type UploadTargetInput = {
  storageKey: string;
  contentType: string;
  fileSize: number;
};

type VerifyUploadInput = UploadTargetInput & {
  providerMode: UploadProviderMode;
};

@Injectable()
export class UploadStorageService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    @Inject(S3_PRESIGNED_POST)
    private readonly presignPost: PresignedPostFactory,
    @Inject(S3_GET_SIGNED_URL)
    private readonly signGetUrl: S3GetSignedUrlFactory,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  getProviderMode(): UploadProviderMode {
    const configured = (
      this.configService.get<string>('UPLOAD_PROVIDER_MODE') ?? 'mock'
    )
      .trim()
      .toLowerCase();

    if (configured !== 'mock' && configured !== 's3') {
      throw new InternalServerErrorException(
        'UPLOAD_PROVIDER_MODE must be mock or s3.',
      );
    }

    return configured;
  }

  getMaxUploadBytes() {
    return this.readInteger(
      'UPLOAD_MAX_BYTES',
      10 * 1024 * 1024,
      1,
      50 * 1024 * 1024,
    );
  }

  getAllowedContentTypes() {
    const configured = this.configService.get<string>(
      'UPLOAD_ALLOWED_MIME_TYPES',
    );
    const values = (configured || 'image/jpeg,image/png,image/webp')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return new Set(values);
  }

  async createUploadTarget(input: UploadTargetInput) {
    const providerMode = this.getProviderMode();
    const expiresIn = this.readInteger(
      'UPLOAD_URL_EXPIRES_SECONDS',
      900,
      60,
      3600,
    );
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    if (providerMode === 'mock') {
      return {
        providerMode,
        uploadMethod: 'MOCK' as const,
        uploadUrl: `mock://souvenote/uploads/${input.storageKey}`,
        formFields: {},
        expiresAt,
      };
    }

    const { bucket } = this.getS3Configuration();
    const post = await this.presignPost(this.s3Client, {
      Bucket: bucket,
      Key: input.storageKey,
      Expires: expiresIn,
      Fields: {
        'Content-Type': input.contentType,
      },
      Conditions: [
        ['content-length-range', input.fileSize, input.fileSize],
        { 'Content-Type': input.contentType },
      ],
    });

    return {
      providerMode,
      uploadMethod: 'POST' as const,
      uploadUrl: post.url,
      formFields: post.fields,
      expiresAt,
    };
  }

  async verifyUpload(input: VerifyUploadInput) {
    if (input.providerMode === 'mock') {
      return {
        contentLength: input.fileSize,
        contentType: input.contentType,
        etag: null,
      };
    }

    const { bucket } = this.getS3Configuration();
    let object: HeadObjectCommandOutput;

    try {
      const action = () =>
        this.s3Client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: input.storageKey,
          }),
        );
      object = await (this.providerTelemetry
        ? this.providerTelemetry.measure('s3', 's3_head', action)
        : action());
    } catch {
      throw new BadRequestException(
        'The uploaded S3 object could not be verified. Upload the file again.',
      );
    }

    if (object.ContentLength !== input.fileSize) {
      throw new BadRequestException(
        'The uploaded file size does not match the upload request.',
      );
    }

    if (object.ContentType?.toLowerCase() !== input.contentType.toLowerCase()) {
      throw new BadRequestException(
        'The uploaded file type does not match the upload request.',
      );
    }

    return {
      contentLength: object.ContentLength,
      contentType: object.ContentType,
      etag: object.ETag?.replace(/^"|"$/g, '') ?? null,
    };
  }

  async createReadUrl(storageKey: string, options: ReadUrlOptions = {}) {
    if (storageKey.startsWith('mock/')) {
      return null;
    }
    this.assertPrivateAssetKey(storageKey);

    const { bucket } = this.getS3Configuration();
    const expiresIn = this.readInteger(
      options.expiresInSetting ?? 'ASSET_READ_URL_EXPIRES_SECONDS',
      options.defaultExpiresIn ?? 300,
      60,
      3600,
    );
    return this.signGetUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
      { expiresIn },
    );
  }

  private assertPrivateAssetKey(storageKey: string) {
    const validPrefix =
      storageKey.startsWith('uploads/') || storageKey.startsWith('generated/');
    const segments = storageKey.split('/');
    const hasUnsafeCharacter = [...storageKey].some((character) => {
      const code = character.charCodeAt(0);
      return character === '\\' || code <= 31 || code === 127;
    });
    if (
      !validPrefix ||
      storageKey.length > 1024 ||
      segments.some((segment) => !segment || segment === '..') ||
      hasUnsafeCharacter
    ) {
      throw new InternalServerErrorException(
        'Private asset storage key is invalid.',
      );
    }
  }

  private getS3Configuration() {
    const region = (this.configService.get<string>('AWS_REGION') ?? '').trim();
    const bucket = (
      this.configService.get<string>('AWS_S3_BUCKET_NAME') ?? ''
    ).trim();

    if (!region || !bucket) {
      throw new InternalServerErrorException(
        'AWS_REGION and AWS_S3_BUCKET_NAME are required in S3 upload mode.',
      );
    }

    return { region, bucket };
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

export function createS3Client(configService: ConfigService) {
  const region = configService.get<string>('AWS_REGION')?.trim() || 'us-east-1';
  const endpoint = configService.get<string>('AWS_S3_ENDPOINT')?.trim();
  const forcePathStyle =
    configService.get<string>('AWS_S3_FORCE_PATH_STYLE')?.toLowerCase() ===
    'true';

  return new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
  });
}

export const defaultPresignedPostFactory: PresignedPostFactory = (
  client,
  options,
) => createPresignedPost(client, options);

export const defaultS3GetSignedUrlFactory: S3GetSignedUrlFactory = (
  client,
  command,
  options,
) => getSignedUrl(client, command, options);
