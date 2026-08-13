import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { FulfillmentJobResponseDto } from '../common/api-response.dto';
import { Idempotent } from '../common/idempotent.decorator';
import { FulfillmentService } from './fulfillment.service';

export class SubmitFulfillmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ enum: ['personalized', 'blank_handoff'], required: false, default: 'personalized' })
  @IsOptional()
  @IsIn(['personalized', 'blank_handoff'])
  variant?: 'personalized' | 'blank_handoff';
}

@ApiTags('fulfillment-jobs')
@ApiBearerAuth()
@Controller('fulfillment-jobs')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'submitFulfillmentJob' })
  @ApiCreatedResponse({ type: FulfillmentJobResponseDto })
  submit(@Req() request: AuthenticatedRequest, @Body() dto: SubmitFulfillmentDto) {
    return this.fulfillmentService.submit(
      request.user.id,
      dto.orderId,
      request.header('idempotency-key')!,
      dto.variant ?? 'personalized',
    );
  }

  @Post(':jobId/retry')
  @Idempotent()
  @ApiOperation({ operationId: 'retryFulfillmentJob' })
  @ApiCreatedResponse({ type: FulfillmentJobResponseDto })
  retry(@Req() request: AuthenticatedRequest, @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string) {
    return this.fulfillmentService.retry(request.user.id, jobId);
  }

  @Get(':jobId')
  @ApiOperation({ operationId: 'getFulfillmentJob' })
  @ApiOkResponse({ type: FulfillmentJobResponseDto })
  get(@Req() request: AuthenticatedRequest, @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string) {
    return this.fulfillmentService.get(request.user.id, jobId);
  }
}
