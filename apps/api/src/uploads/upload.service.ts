import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { UploadRepository } from './upload.repository';

export type UploadRequestInput = {
  cardDraftId: string;
  filename: string;
  mimeType: string;
  size: number;
  contentSha256: string;
};

@Injectable()
export class UploadService {
  constructor(private readonly repository: UploadRepository) {}

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
    const storageKey = `private/${userId}/${input.cardDraftId}/${randomUUID()}`;
    return {
      upload: UploadRepository.toApi(
        await this.repository.request(userId, idempotencyKey, requestHash, storageKey, input),
      ),
    };
  }

  async get(userId: string, uploadId: string) {
    return { upload: UploadRepository.toApi(await this.repository.get(userId, uploadId)) };
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
