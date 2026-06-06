import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}
  @Get()
  async getHealth() {
    await this.databaseService.query('SELECT 1');
    return {
      status: 'ok',
      service: "souvenote-backend",
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}