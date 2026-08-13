import { createDeterministicIdempotencyKey, RetrySafeIdempotencyKeys } from './retrySafeIdempotency';

describe('retry-safe idempotency keys', () => {
  it('reuses an unresolved action key and rotates it only after completion', () => {
    const keys = new RetrySafeIdempotencyKeys();
    const first = keys.keyFor('draft:initial_image', 'frontend-generation');

    expect(keys.keyFor('draft:initial_image', 'frontend-generation')).toBe(first);
    expect(keys.keyFor('draft:regenerate_image', 'frontend-generation')).not.toBe(first);

    keys.complete('draft:initial_image', first);
    expect(keys.keyFor('draft:initial_image', 'frontend-generation')).not.toBe(first);
  });

  it('creates stable approval keys within the API idempotency boundary', async () => {
    const signature = [
      'draft-id-with-a-full-uuid',
      'image-asset-id-with-a-full-uuid',
      'no-song',
      'message-asset-id-with-a-full-uuid',
    ].join(':');
    const first = await createDeterministicIdempotencyKey('draft-approval', signature);

    expect(first).toBe(await createDeterministicIdempotencyKey('draft-approval', signature));
    expect(first).toMatch(/^draft-approval-[a-f0-9]{64}$/);
    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(first.length).toBeLessThanOrEqual(128);
  });
});
