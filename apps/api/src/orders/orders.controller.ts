import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { OrderListResponseDto, OrderResponseDto } from '../common/api-response.dto';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPostalCode,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { CursorPaginationQueryDto } from '../common/pagination.dto';
import { OrdersService } from './orders.service';

export class PostalAddressDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ minLength: 2, maxLength: 3 })
  @IsString()
  @Length(2, 3)
  @Matches(/^[A-Za-z]{2,3}$/)
  region!: string;

  @ApiProperty({ example: 'V6B 1A1' })
  @IsPostalCode('CA')
  postalCode!: string;

  @ApiProperty({ enum: ['CA'] })
  @IsIn(['CA'])
  country!: 'CA';
}

export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardDraftId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  selectedAssetId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  offerId!: string;

  @ApiProperty({ minimum: 1, maximum: 30 })
  @IsInt()
  @Min(1)
  @Max(30)
  quantity!: number;

  @ApiProperty({ type: PostalAddressDto })
  @ValidateNested()
  @Type(() => PostalAddressDto)
  recipientAddress!: PostalAddressDto;

  @ApiProperty({ type: PostalAddressDto })
  @ValidateNested()
  @Type(() => PostalAddressDto)
  senderAddress!: PostalAddressDto;
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'createOrder' })
  @ApiCreatedResponse({ type: OrderResponseDto })
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(request.user.id, request.header('idempotency-key')!, dto);
  }

  @Get()
  @ApiOperation({ operationId: 'listOrders' })
  @ApiOkResponse({ type: OrderListResponseDto })
  async list(@Req() request: AuthenticatedRequest, @Query() query: CursorPaginationQueryDto) {
    return this.ordersService.list(request.user.id, query.limit ?? 20, query.cursor);
  }

  @Get(':orderId')
  @ApiOperation({ operationId: 'getOrder' })
  @ApiOkResponse({ type: OrderResponseDto })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.ordersService.get(request.user.id, orderId);
  }
}
