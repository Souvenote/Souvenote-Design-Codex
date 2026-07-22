import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { FulfillmentJobResponseDto } from '../common/api-response.dto';
import { IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { FulfillmentService } from './fulfillment.service';

export class SubmitFulfillmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;
}

@ApiTags('fulfillment-jobs')
@ApiBearerAuth()
@Controller('fulfillment-jobs')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'submitFulfillmentJob' })
  async submit(@Req() request: AuthenticatedRequest, @Body() dto: SubmitFulfillmentDto) {
    return this.fulfillmentService.submit(request.user.id, dto.orderId, request.header('idempotency-key')!);
  }

  @Get(':jobId')
  @ApiOperation({ operationId: 'getFulfillmentJob' })
  @ApiOkResponse({ type: FulfillmentJobResponseDto })
  async get(@Req() request: AuthenticatedRequest, @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string) {
    return this.fulfillmentService.get(request.user.id, jobId);
  }
}
