import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { OrdersService } from './orders.service';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  selectedAssetId: string;

  @IsOptional()
  @IsString()
  offerCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  recipientAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  senderAddress?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get('user/:userId')
  async listOrdersByUser(@Param('userId') userId: string) {
    return this.ordersService.listOrders(userId);
  }

  @Get(':orderId')
  async getOrderById(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderById(orderId);
  }
}
