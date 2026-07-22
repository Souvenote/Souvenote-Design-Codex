import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseHealthService } from '../database/database-health.service';
import type { WorkerRuntimeConfig } from '../runtime/runtime-config';
import { WORKER_RUNTIME_CONFIG } from '../runtime/runtime.module';

type LiveHealth = Readonly<{
  mode: 'idle';
  service: 'souvenote-worker';
  status: 'ok';
}>;

type ReadyHealth = LiveHealth &
  Readonly<{
    database: 'connected';
  }>;

@Controller('health')
export class HealthController {
  constructor(
    private readonly databaseHealth: DatabaseHealthService,
    @Inject(WORKER_RUNTIME_CONFIG)
    private readonly config: WorkerRuntimeConfig,
  ) {}

  @Get('live')
  getLive(): LiveHealth {
    return {
      mode: this.config.workerMode,
      service: 'souvenote-worker',
      status: 'ok',
    };
  }

  @Get('ready')
  async getReady(): Promise<ReadyHealth> {
    try {
      await this.databaseHealth.ping();
    } catch {
      throw new ServiceUnavailableException({
        code: 'WORKER_DATABASE_UNAVAILABLE',
        message: 'Worker database readiness check failed.',
        service: 'souvenote-worker',
        status: 'unavailable',
      });
    }

    return {
      ...this.getLive(),
      database: 'connected',
    };
  }
}
