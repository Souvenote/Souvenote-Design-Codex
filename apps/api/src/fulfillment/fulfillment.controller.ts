import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FulfillmentService } from './fulfillment.service';

export class SubmitFulfillmentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  estimatedDelivery?: string;
}

@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post('submit')
  async submitFulfillment(@Body() dto: SubmitFulfillmentDto) {
    return this.fulfillmentService.submitFulfillment(dto);
  }

  @Get('order/:orderId')
  async getFulfillmentByOrder(@Param('orderId') orderId: string) {
    return this.fulfillmentService.getFulfillmentByOrder(orderId);
  }
}
