import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  GenerationAssetStorageService,
  type GenerationFetch,
} from './generation-asset-storage.service';
import type { GenerationProviderResult } from './generation.provider';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe('GenerationAssetStorageService', () => {
  const config: Record<string, string> = {
    AWS_REGION: 'us-west-2',
    AWS_S3_BUCKET_NAME: 'souvenote-private',
  };
  const getConfig = jest.fn((key: string) => config[key]);
  const configService = { get: getConfig } as unknown as ConfigService;
  const send = jest.fn<Promise<unknown>, [command: unknown]>();
  const s3Client = { send } as unknown as S3Client;
  const fetchAsset =
    jest.fn() as unknown as jest.MockedFunction<GenerationFetch>;
  const service = new GenerationAssetStorageService(
    configService,
    s3Client,
    fetchAsset,
  );

  const materialize = (result: GenerationProviderResult) =>
    service.materialize({
      userId: 'user-a',
      cardDraftId: 'draft-a',
      generationJobId: 'job-a',
      providerMode: result.providerMode,
      result,
    });

  beforeEach(() => {
    for (const key of Object.keys(config)) {
      if (!['AWS_REGION', 'AWS_S3_BUCKET_NAME'].includes(key)) {
        delete config[key];
      }
    }
    getConfig.mockClear();
    send.mockReset();
    fetchAsset.mockReset();
    send.mockResolvedValue({});
  });

  it('keeps approved mock keys without touching S3', async () => {
    await expect(
      materialize({
        providerMode: 'mock',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'stored',
              storageKey: 'mock/generation/job-a/card.png',
            },
            metadata: { source: 'mock_generation' },
          },
        ],
      }),
    ).resolves.toEqual([
      {
        assetType: 'image',
        storageKey: 'mock/generation/job-a/card.png',
        moderationState: 'approved_mock',
        metadata: { source: 'mock_generation' },
      },
    ]);

    expect(fetchAsset).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects provider-owned stored keys outside mock mode', async () => {
    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: { kind: 'stored', storageKey: 'external/card.png' },
            metadata: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('streams a trusted Fal image into a deterministic private S3 key', async () => {
    fetchAsset.mockResolvedValue(
      new Response(png, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(png.byteLength),
        },
      }),
    );

    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: { image: { requestId: 'request-a' } },
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://v3b.fal.media/files/card.png',
              contentType: 'image/png',
            },
            metadata: { requestId: 'request-a' },
          },
        ],
      }),
    ).resolves.toEqual([
      {
        assetType: 'image',
        storageKey: 'generated/user-a/draft-a/job-a/image.png',
        moderationState: 'pending',
        metadata: {
          requestId: 'request-a',
          providerMode: 'fal',
          contentType: 'image/png',
          sizeBytes: png.byteLength,
        },
      },
    ]);

    expect(fetchAsset).toHaveBeenCalledWith(
      new URL('https://v3b.fal.media/files/card.png'),
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
    );
    const sendCalls = send.mock.calls as unknown as Array<[unknown]>;
    const command = sendCalls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'souvenote-private',
      Key: 'generated/user-a/draft-a/job-a/image.png',
      ContentType: 'image/png',
      ServerSideEncryption: 'AES256',
      Metadata: {
        generationjobid: 'job-a',
        providermode: 'fal',
        assettype: 'image',
      },
    });
    expect(
      Buffer.from((command as PutObjectCommand).input.Body as Uint8Array),
    ).toEqual(png);
  });

  it('stores inline messages as encrypted private text assets', async () => {
    config.AWS_S3_KMS_KEY_ID = 'alias/souvenote-assets';

    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'message',
            source: {
              kind: 'inline',
              data: 'Happy birthday!',
              contentType: 'text/plain; charset=utf-8',
            },
            metadata: { text: 'Happy birthday!' },
          },
        ],
      }),
    ).resolves.toMatchObject([
      {
        assetType: 'message',
        storageKey: 'generated/user-a/draft-a/job-a/message.txt',
        moderationState: 'approved',
      },
    ]);

    const sendCalls = send.mock.calls as unknown as Array<[unknown]>;
    const command = sendCalls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'alias/souvenote-assets',
    });
  });

  it('rejects untrusted URLs before making a network request', async () => {
    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://fal.media.attacker.example/card.png',
              contentType: 'image/png',
            },
            metadata: {},
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it('rejects a response MIME type that disagrees with provider metadata', async () => {
    fetchAsset.mockResolvedValue(
      new Response('not an image', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://fal.media/files/card.png',
              contentType: 'image/png',
            },
            metadata: {},
          },
        ],
      }),
    ).rejects.toThrow('content type did not match');

    expect(send).not.toHaveBeenCalled();
  });

  it('rejects invalid file signatures even when MIME headers agree', async () => {
    fetchAsset.mockResolvedValue(
      new Response('not a png', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );

    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://fal.media/files/card.png',
              contentType: 'image/png',
            },
            metadata: {},
          },
        ],
      }),
    ).rejects.toThrow('file signature was invalid');

    expect(send).not.toHaveBeenCalled();
  });

  it('stops streaming when a response exceeds the configured maximum', async () => {
    config.GENERATION_MAX_IMAGE_BYTES = '8';
    fetchAsset.mockResolvedValue(
      new Response(png, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );

    await expect(
      materialize({
        providerMode: 'fal',
        providerJobRefs: {},
        resultMetadata: {},
        assets: [
          {
            assetType: 'image',
            source: {
              kind: 'remote',
              url: 'https://fal.media/files/card.png',
              contentType: 'image/png',
            },
            metadata: {},
          },
        ],
      }),
    ).rejects.toThrow('exceeds the allowed size');

    expect(send).not.toHaveBeenCalled();
  });
});
