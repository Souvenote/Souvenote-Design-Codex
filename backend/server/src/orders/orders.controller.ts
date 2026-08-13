import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrdersService } from './orders.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class PostalAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  region: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  postalCode: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  country: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  selectedAssetId: string;

  @IsOptional()
  @IsIn(['checkout', 'card_bank'])
  fundingSource?: 'checkout' | 'card_bank';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  offerCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  quantity?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  recipientAddress: PostalAddressDto;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => PostalAddressDto)
  recipientAddresses?: PostalAddressDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  senderAddress: PostalAddressDto;
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(request.localUser.id, dto);
  }

  @Get()
  async listOrders(@Req() request: AuthenticatedRequest) {
    return this.ordersService.listOrders(request.localUser.id);
  }

  @Get(':orderId')
  async getOrderById(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getOrderById(request.localUser.id, orderId);
  }
}
