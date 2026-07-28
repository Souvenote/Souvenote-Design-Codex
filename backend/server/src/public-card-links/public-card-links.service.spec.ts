import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';
import { PublicCardLinksService } from './public-card-links.service';

describe('PublicCardLinksService', () => {
  const secret = '11'.repeat(32);
  const query = jest.fn();
  const createReadUrl = jest.fn();
  const service = new PublicCardLinksService(
    { query } as unknown as DatabaseService,
    {
      get: (key: string) =>
        key === 'PUBLIC_LINK_HMAC_SECRET' ? secret : undefined,
    } as unknown as ConfigService,
    { createReadUrl } as unknown as UploadStorageService,
  );

  beforeEach(() => {
    query.mockReset();
    createReadUrl.mockReset();
  });

  it('derives a stable token and persists only its SHA-256 hash', async () => {
    const orderId = 'order-a';
    const token = createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`souvenote-public-link:v1:${orderId}`)
      .digest('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ token_hash: tokenHash, status: 'active' }],
    });

    await expect(service.getOrCreateToken(orderId)).resolves.toBe(token);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO public_card_links'),
      [orderId, tokenHash],
    );
    expect(JSON.stringify(query.mock.calls)).not.toContain(token);
  });

  it('returns only approved keepsake media behind a valid active token', async () => {
    const token = 'A'.repeat(43);
    query
      .mockResolvedValueOnce({
        rows: [
          {
            order_id: 'order-a',
            user_id: 'user-a',
            card_draft_id: 'draft-a',
            selected_asset_id: 'image-a',
            occasion: 'Birthday',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'image-a',
            asset_type: 'image',
            s3_key: 'generated/user-a/draft-a/job-a/image.png',
            qr_metadata: {},
          },
          {
            id: 'song-a',
            asset_type: 'song',
            s3_key: 'generated/user-a/draft-a/job-a/song.mp3',
            qr_metadata: {},
          },
          {
            id: 'message-a',
            asset_type: 'message',
            s3_key: 'generated/user-a/draft-a/job-a/message.txt',
            qr_metadata: { text: 'A message for you.' },
          },
        ],
      });
    createReadUrl
      .mockResolvedValueOnce('https://assets.example/image.png?signed=1')
      .mockResolvedValueOnce('https://assets.example/song.mp3?signed=1');

    await expect(service.getPublicSouvenote(token)).resolves.toEqual({
      occasion: 'Birthday',
      imageUrl: 'https://assets.example/image.png?signed=1',
      songUrl: 'https://assets.example/song.mp3?signed=1',
      insideMessage: 'A message for you.',
      assetUrlExpiresInSeconds: 300,
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('order_record.status IN'),
      [createHash('sha256').update(token).digest('hex')],
    );
  });

  it('rejects malformed tokens without querying storage', async () => {
    await expect(service.getPublicSouvenote('not-a-token')).rejects.toThrow(
      'Souvenote not found.',
    );
    expect(query).not.toHaveBeenCalled();
  });
});
