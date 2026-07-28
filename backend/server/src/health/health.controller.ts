import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PublicRoute } from '../auth/public-route.decorator';

@Controller('health')
@PublicRoute()
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async getHealth() {
    return this.getReadiness();
  }

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      service: 'souvenote-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    try {
      await this.databaseService.query('SELECT 1 AS ready;');
    } catch {
      throw new ServiceUnavailableException(
        'Souvenote backend is not ready to accept traffic.',
      );
    }

    return {
      status: 'ok',
      service: 'souvenote-backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
