import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { LocalObjectStorageService } from '../storage/local-object-storage.service';
import { UploadRepository } from './upload.repository';

export type UploadRequestInput = {
  cardDraftId: string;
  filename: string;
  mimeType: string;
  size: number;
  contentSha256: string;
};

const FORMAT_TO_MIME: Readonly<Record<string, string>> = Object.freeze({
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});

@Injectable()
export class UploadService {
  constructor(
    private readonly repository: UploadRepository,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async request(userId: string, idempotencyKey: string, input: UploadRequestInput) {
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          cardDraftId: input.cardDraftId,
          filename: input.filename.trim(),
          mimeType: input.mimeType,
          size: input.size,
          contentSha256: input.contentSha256,
        }),
      )
      .digest('hex');
    const storageKey = `private/${userId}/${input.cardDraftId}/uploads/${randomUUID()}`;
    return {
      upload: UploadRepository.toApi(
        await this.repository.request(userId, idempotencyKey, requestHash, storageKey, input),
      ),
    };
  }

  async get(userId: string, uploadId: string) {
    return { upload: UploadRepository.toApi(await this.repository.get(userId, uploadId)) };
  }

  async storeContent(userId: string, uploadId: string, idempotencyKey: string, content: Buffer) {
    const upload = await this.repository.get(userId, uploadId);
    if (!Buffer.isBuffer(content) || content.length === 0 || content.length > 10_485_760) {
      throw new BadRequestException({ code: 'UPLOAD_BYTES_INVALID', message: 'Upload content is empty or too large.' });
    }
    if (content.length !== Number(upload.size_bytes)) {
      throw new BadRequestException({ code: 'UPLOAD_SIZE_MISMATCH', message: 'Upload content size did not match.' });
    }
    const contentHash = createHash('sha256').update(content).digest('hex');
    if (contentHash !== upload.content_sha256) {
      throw new BadRequestException({ code: 'UPLOAD_HASH_MISMATCH', message: 'Upload content hash did not match.' });
    }

    let metadata: Metadata;
    try {
      metadata = await sharp(content, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
      throw new BadRequestException({ code: 'UPLOAD_IMAGE_INVALID', message: 'Upload content is not a valid image.' });
    }
    const detectedMime = metadata.format ? FORMAT_TO_MIME[metadata.format] : undefined;
    if (!detectedMime || detectedMime !== upload.media_type || !metadata.width || !metadata.height) {
      throw new BadRequestException({
        code: 'UPLOAD_MEDIA_MISMATCH',
        message: 'Upload bytes do not match the declared JPEG, PNG, or WebP media type.',
      });
    }
    if ((metadata.pages ?? 1) !== 1 || metadata.width > 10_000 || metadata.height > 10_000) {
      throw new BadRequestException({
        code: 'UPLOAD_DIMENSIONS_INVALID',
        message: 'Upload dimensions or frame count are not supported.',
      });
    }

    await this.storage.put(upload.storage_key, content);
    return {
      upload: UploadRepository.toApi(
        await this.repository.markContentStored(userId, uploadId, idempotencyKey, metadata.width, metadata.height),
      ),
    };
  }

  async complete(userId: string, uploadId: string, idempotencyKey: string, attestationAccepted: boolean) {
    if (!attestationAccepted) {
      throw new BadRequestException({
        code: 'ATTESTATION_REQUIRED',
        message: 'Image-rights attestation must be accepted before the upload can be committed.',
      });
    }
    return {
      upload: UploadRepository.toApi(await this.repository.completeMock(userId, uploadId, idempotencyKey)),
    };
  }
}
