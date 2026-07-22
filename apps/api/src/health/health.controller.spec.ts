import { ServiceUnavailableException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const databaseService: Pick<DatabaseService, 'ping'> = {
    ping: jest.fn(),
  };
  const controller = new HealthController(databaseService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reports liveness without accessing the database', () => {
    expect(controller.getLiveness()).toMatchObject({
      status: 'ok',
      service: 'souvenote-backend',
    });
    expect(databaseService.ping).not.toHaveBeenCalled();
  });

  it('reports readiness after a successful bounded database ping', async () => {
    jest.mocked(databaseService.ping).mockResolvedValueOnce();

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
    });
    expect(databaseService.ping).toHaveBeenCalledTimes(1);
  });

  it('keeps the compatibility health route database-backed', async () => {
    jest.mocked(databaseService.ping).mockResolvedValueOnce();

    await expect(controller.getHealth()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns a sanitized service-unavailable response when the database fails', async () => {
    jest.mocked(databaseService.ping).mockRejectedValueOnce(new Error('password secret-db-password'));

    try {
      await controller.getReadiness();
      throw new Error('Expected readiness to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      if (!(error instanceof ServiceUnavailableException)) throw error;
      const response = error.getResponse();
      expect(response).toMatchObject({
        status: 'unavailable',
        database: 'unavailable',
      });
      expect(JSON.stringify(response)).not.toContain('secret-db-password');
    }
  });
});
