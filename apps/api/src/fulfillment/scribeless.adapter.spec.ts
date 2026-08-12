import { DeterministicScribelessAdapter, type ScribelessSubmission } from './scribeless.adapter';

const personalized: ScribelessSubmission = {
  contractVersion: 'scribeless.mock.v1',
  idempotencyKey: 'order:45000000-0000-4000-8000-000000000001',
  orderId: '45000000-0000-4000-8000-000000000001',
  orderNumber: 'SOUV-TEST-0001',
  variant: 'personalized',
  quantity: 1,
  recipientAddress: {
    name: 'Synthetic Recipient',
    line1: '100 Test Street',
    city: 'Vancouver',
    region: 'BC',
    postalCode: 'V6B 1A1',
    country: 'CA',
  },
  senderAddress: {
    name: 'Synthetic Sender',
    line1: '200 Test Avenue',
    city: 'Victoria',
    region: 'BC',
    postalCode: 'V8W 1A1',
    country: 'CA',
  },
  artwork: { storageKey: 'private/test/art.png', contentSha256: 'a'.repeat(64), mediaType: 'image/png' },
  insideMessage: { storageKey: 'private/test/message.txt', contentSha256: 'b'.repeat(64), mediaType: 'text/plain' },
  qr: { publicPath: '/card/test-token', payloadVersion: 1 },
};

describe('DeterministicScribelessAdapter', () => {
  it('returns a stable provider result without network activity or persisted raw payloads', async () => {
    const adapter = new DeterministicScribelessAdapter();

    const first = await adapter.submit(personalized);
    const second = await adapter.submit(personalized);

    expect(first).toEqual(second);
    expect(first.provider).toBe('mock');
    expect(first.providerJobId).toMatch(/^mock_print_[0-9a-f]{32}$/);
    expect(first.responsePayloadSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the blank-card handoff free of artwork, message, and QR data', async () => {
    const adapter = new DeterministicScribelessAdapter();
    const blank = { ...personalized, variant: 'blank_handoff' as const, artwork: null, insideMessage: null, qr: null };

    await expect(adapter.submit(blank)).resolves.toMatchObject({ provider: 'mock', accepted: true });
    expect(blank).toMatchObject({ artwork: null, insideMessage: null, qr: null });
  });
});
