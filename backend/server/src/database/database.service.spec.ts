import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

describe('DatabaseService transactions', () => {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const pool = {
    connect: jest.fn().mockResolvedValue(client),
    end: jest.fn(),
  };
  let service: DatabaseService;

  beforeEach(() => {
    client.query.mockReset().mockResolvedValue({ rows: [] });
    client.release.mockReset();
    pool.connect.mockClear();
    pool.end.mockReset();
    const configService = {
      get: jest.fn((key: string) =>
        key === 'DATABASE_URL' ? 'postgresql://localhost/test' : undefined,
      ),
    } as unknown as ConfigService;
    service = new DatabaseService(configService);
    Object.defineProperty(service, 'pool', { value: pool });
  });

  it('enforces read-only mode and a five-second local statement timeout', async () => {
    const result = await service.withReadOnlyTransaction(
      async (transaction) => {
        await transaction.query('SELECT id FROM orders WHERE id = $1', [
          'order-id',
        ]);
        return 'evidence';
      },
    );

    expect(result).toBe('evidence');
    expect(client.query.mock.calls).toEqual([
      ['BEGIN TRANSACTION READ ONLY'],
      ["SET LOCAL statement_timeout = '5000ms'"],
      ['SELECT id FROM orders WHERE id = $1', ['order-id']],
      ['COMMIT'],
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when a read operation fails', async () => {
    await expect(
      service.withReadOnlyTransaction(async () => {
        await Promise.resolve();
        throw new Error('read failed');
      }),
    ).rejects.toThrow('read failed');

    expect(client.query.mock.calls).toEqual([
      ['BEGIN TRANSACTION READ ONLY'],
      ["SET LOCAL statement_timeout = '5000ms'"],
      ['ROLLBACK'],
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
