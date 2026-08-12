import type { LocalObjectStorageService } from '../storage/local-object-storage.service';
import type { UploadRepository } from './upload.repository';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  it.each([
    ['string', 'not-binary'],
    ['array', ['not-binary']],
    ['plain object', { length: 1 }],
    ['null', null],
  ])('rejects a runtime %s body before storage', async (_label, content) => {
    const repository = {
      get: jest.fn().mockResolvedValue({
        size_bytes: 1,
        content_sha256: '0'.repeat(64),
        media_type: 'image/png',
        storage_key: 'private/test/upload',
      }),
    } as unknown as UploadRepository;
    const put = jest.fn();
    const storage = { put } as unknown as LocalObjectStorageService;
    const service = new UploadService(repository, storage);

    await expect(service.storeContent('user-id', 'upload-id', 'idempotency-key', content)).rejects.toMatchObject({
      response: { code: 'UPLOAD_BYTES_INVALID' },
    });
    expect(put).not.toHaveBeenCalled();
  });
});
