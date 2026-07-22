import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Public } from '../common/public.decorator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from '../common/api-response.dto';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: Pick<DatabaseService, 'ping'>,
  ) {}

  @Get('live')
  @ApiOperation({ operationId: 'getLiveness' })
  @ApiOkResponse({ type: HealthResponseDto })
  getLiveness() {
    return this.healthyResponse();
  }

  @Get('ready')
  @ApiOperation({ operationId: 'getReadiness' })
  @ApiOkResponse({ type: HealthResponseDto })
  async getReadiness() {
    return this.databaseReadiness();
  }

  @Get()
  @ApiOperation({ operationId: 'getHealth' })
  @ApiOkResponse({ type: HealthResponseDto })
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
