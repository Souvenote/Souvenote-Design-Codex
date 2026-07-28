import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  type PresignedPostFactory,
  type S3GetSignedUrlFactory,
  UploadStorageService,
} from './upload-storage.service';

describe('UploadStorageService', () => {
  const settings: Record<string, string | undefined> = {};
  const configService = {
    get: jest.fn((key: string) => settings[key]),
  } as unknown as ConfigService;
  const send = jest.fn();
  const s3Client = { send } as unknown as S3Client;
  const presignPost = jest.fn() as jest.MockedFunction<PresignedPostFactory>;
  const signGetUrl =
    jest.fn() as unknown as jest.MockedFunction<S3GetSignedUrlFactory>;
  const service = new UploadStorageService(
    configService,
    s3Client,
    presignPost,
    signGetUrl,
  );

  beforeEach(() => {
    for (const key of Object.keys(settings)) delete settings[key];
    send.mockReset();
    presignPost.mockReset();
    signGetUrl.mockReset();
  });

  it('returns a no-network target in mock mode', async () => {
    await expect(
      service.createUploadTarget({
        storageKey: 'mock/user/draft/file.png',
        contentType: 'image/png',
        fileSize: 100,
      }),
    ).resolves.toMatchObject({
      providerMode: 'mock',
      uploadMethod: 'MOCK',
      uploadUrl: 'mock://souvenote/uploads/mock/user/draft/file.png',
      formFields: {},
    });

    expect(presignPost).not.toHaveBeenCalled();
  });

  it('creates a constrained S3 POST policy for the exact file', async () => {
    settings.UPLOAD_PROVIDER_MODE = 's3';
    settings.AWS_REGION = 'ca-central-1';
    settings.AWS_S3_BUCKET_NAME = 'private-souvenote-assets';
    settings.UPLOAD_URL_EXPIRES_SECONDS = '600';
    presignPost.mockResolvedValue({
      url: 'https://private-souvenote-assets.s3.amazonaws.com',
      fields: { policy: 'signed-policy' },
    });

    await expect(
      service.createUploadTarget({
        storageKey: 'uploads/user/draft/file.png',
        contentType: 'image/png',
        fileSize: 1234,
      }),
    ).resolves.toMatchObject({
      providerMode: 's3',
      uploadMethod: 'POST',
      uploadUrl: 'https://private-souvenote-assets.s3.amazonaws.com',
      formFields: { policy: 'signed-policy' },
    });

    expect(presignPost).toHaveBeenCalledWith(
      s3Client,
      expect.objectContaining({
        Bucket: 'private-souvenote-assets',
        Key: 'uploads/user/draft/file.png',
        Expires: 600,
        Fields: { 'Content-Type': 'image/png' },
      }),
    );
    expect(presignPost.mock.calls[0][1].Conditions).toEqual([
      ['content-length-range', 1234, 1234],
      { 'Content-Type': 'image/png' },
    ]);
  });

  it('verifies S3 object size, type, and ETag with HeadObject', async () => {
    settings.UPLOAD_PROVIDER_MODE = 's3';
    settings.AWS_REGION = 'ca-central-1';
    settings.AWS_S3_BUCKET_NAME = 'private-souvenote-assets';
    send.mockResolvedValue({
      ContentLength: 1234,
      ContentType: 'image/png',
      ETag: '"etag-value"',
    });

    await expect(
      service.verifyUpload({
        providerMode: 's3',
        storageKey: 'uploads/user/draft/file.png',
        contentType: 'image/png',
        fileSize: 1234,
      }),
    ).resolves.toEqual({
      contentLength: 1234,
      contentType: 'image/png',
      etag: 'etag-value',
    });

    expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
  });

  it('rejects S3 objects whose metadata does not match the request', async () => {
    settings.UPLOAD_PROVIDER_MODE = 's3';
    settings.AWS_REGION = 'ca-central-1';
    settings.AWS_S3_BUCKET_NAME = 'private-souvenote-assets';
    send.mockResolvedValue({
      ContentLength: 999,
      ContentType: 'image/png',
    });

    await expect(
      service.verifyUpload({
        providerMode: 's3',
        storageKey: 'uploads/user/draft/file.png',
        contentType: 'image/png',
        fileSize: 1234,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing S3 objects without exposing provider details', async () => {
    settings.UPLOAD_PROVIDER_MODE = 's3';
    settings.AWS_REGION = 'ca-central-1';
    settings.AWS_S3_BUCKET_NAME = 'private-souvenote-assets';
    send.mockRejectedValue(new Error('NoSuchKey'));

    await expect(
      service.verifyUpload({
        providerMode: 's3',
        storageKey: 'uploads/user/draft/file.png',
        contentType: 'image/png',
        fileSize: 1234,
      }),
    ).rejects.toThrow('could not be verified');
  });

  it('signs a short-lived read URL for a private owned-key prefix', async () => {
    settings.AWS_REGION = 'ca-central-1';
    settings.AWS_S3_BUCKET_NAME = 'private-souvenote-assets';
    settings.ASSET_READ_URL_EXPIRES_SECONDS = '240';
    signGetUrl.mockResolvedValue(
      'https://private-souvenote-assets.s3.example/card.png?signature=test',
    );

    await expect(
      service.createReadUrl('generated/user/draft/job/image.png'),
    ).resolves.toContain('signature=test');

    expect(signGetUrl).toHaveBeenCalledWith(
      s3Client,
      expect.any(GetObjectCommand),
      { expiresIn: 240 },
    );
    const calls = signGetUrl.mock.calls as unknown as Array<
      [S3Client, GetObjectCommand, { expiresIn: number }]
    >;
    expect(calls[0][1].input).toEqual({
      Bucket: 'private-souvenote-assets',
      Key: 'generated/user/draft/job/image.png',
    });
  });

  it('never signs mock keys or keys outside private asset prefixes', async () => {
    await expect(
      service.createReadUrl('mock/generation/job/image.png'),
    ).resolves.toBeNull();
    await expect(
      service.createReadUrl('unrelated/private-object.txt'),
    ).rejects.toThrow('Private asset storage key is invalid.');

    expect(signGetUrl).not.toHaveBeenCalled();
  });
});
