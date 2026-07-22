import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: Pick<DatabaseService, 'ping'>,
  ) {}

  @Get('live')
  getLiveness() {
    return this.healthyResponse();
  }

  @Get('ready')
  async getReadiness() {
    return this.databaseReadiness();
  }

  @Get()
  async getHealth() {
    return this.databaseReadiness();
  }

  private healthyResponse() {
    return {
      status: 'ok',
      service: 'souvenote-backend',
      timestamp: new Date().toISOString(),
    };
  }

  private async databaseReadiness() {
    try {
      await this.databaseService.ping();
      return {
        ...this.healthyResponse(),
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'souvenote-backend',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
