import { ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const query = jest.fn();
  const controller = new HealthController({
    query,
  } as unknown as DatabaseService);

  beforeEach(() => {
    query.mockReset();
  });

  it('reports liveness without querying PostgreSQL', () => {
    expect(controller.getLiveness()).toMatchObject({
      status: 'ok',
      service: 'souvenote-backend',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['the readiness route', () => controller.getReadiness()],
    ['the backwards-compatible health route', () => controller.getHealth()],
  ])('checks PostgreSQL for %s', async (_label, getHealth) => {
    query.mockResolvedValueOnce({ rows: [{ ready: 1 }] });

    await expect(getHealth()).resolves.toMatchObject({
      status: 'ok',
      service: 'souvenote-backend',
      database: 'connected',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1 AS ready;');
  });

  it('returns a safe 503 when PostgreSQL is unavailable', async () => {
    query.mockRejectedValueOnce(new Error('connection details'));
    const readiness = controller.getReadiness();

    await expect(readiness).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(readiness).rejects.toThrow(
      'Souvenote backend is not ready to accept traffic.',
    );
  });
});
