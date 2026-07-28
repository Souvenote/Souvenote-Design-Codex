import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { FulfillmentService } from './fulfillment.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class SubmitFulfillmentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post('submit')
  async submitFulfillment(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SubmitFulfillmentDto,
  ) {
    return this.fulfillmentService.submitFulfillment(request.localUser.id, dto);
  }

  @Get('order/:orderId')
  async getFulfillmentByOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.fulfillmentService.getFulfillmentByOrder(
      request.localUser.id,
      orderId,
    );
  }

  @Post('order/:orderId/refresh')
  async refreshFulfillmentByOrder(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.fulfillmentService.refreshFulfillmentByOrder(
      request.localUser.id,
      orderId,
    );
  }
}
