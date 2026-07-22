import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  CardEntitlementListResponseDto,
  CardReservationResponseDto,
  TryRiskFreeAuthorizationResponseDto,
  TryRiskFreeStartResponseDto,
} from '../common/api-response.dto';
import { Idempotent } from '../common/idempotent.decorator';
import { CursorPaginationQueryDto } from '../common/pagination.dto';
import { CardEntitlementsService } from './card-entitlements.service';

export class ReserveBigSenderDto {
  @ApiProperty({ type: 'integer', minimum: 2, maximum: 30 })
  @IsInt()
  @Min(2)
  @Max(30)
  quantity!: number;
}

@ApiTags('card-entitlements')
@ApiBearerAuth()
@Controller('card-entitlements')
export class CardEntitlementsController {
  constructor(private readonly service: CardEntitlementsService) {}

  @Get()
  @ApiOperation({ operationId: 'listCardEntitlements' })
  @ApiOkResponse({ type: CardEntitlementListResponseDto })
  async list(@Req() request: AuthenticatedRequest, @Query() query: CursorPaginationQueryDto) {
    return this.service.list(request.user.id, query.limit ?? 20, query.cursor);
  }

  @Post('reservations')
  @Idempotent()
  @ApiOperation({ operationId: 'reserveBigSenderCards' })
  @ApiCreatedResponse({ type: CardReservationResponseDto })
  reserveBigSender(@Req() request: AuthenticatedRequest, @Body() dto: ReserveBigSenderDto) {
    return this.service.reserveBigSender(request.user.id, request.header('idempotency-key')!, dto.quantity);
  }

  @Get('reservations/:reservationId')
  @ApiOperation({ operationId: 'getCardReservation' })
  @ApiOkResponse({ type: CardReservationResponseDto })
  getReservation(
    @Req() request: AuthenticatedRequest,
    @Param('reservationId', new ParseUUIDPipe({ version: '4' })) reservationId: string,
  ) {
    return this.service.getReservation(request.user.id, reservationId);
  }

  @Post('reservations/:reservationId/release')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ operationId: 'releaseCardReservation' })
  @ApiOkResponse({ type: CardReservationResponseDto })
  releaseReservation(
    @Req() request: AuthenticatedRequest,
    @Param('reservationId', new ParseUUIDPipe({ version: '4' })) reservationId: string,
  ) {
    return this.service.releaseReservation(request.user.id, reservationId, request.header('idempotency-key')!);
  }

  @Post('try-risk-free/authorizations')
  @Idempotent()
  @ApiOperation({ operationId: 'startMockTryRiskFreeAuthorization' })
  @ApiCreatedResponse({ type: TryRiskFreeStartResponseDto })
  authorizeTryRiskFree(@Req() request: AuthenticatedRequest) {
    return this.service.authorizeTryRiskFree(request.user.id, request.header('idempotency-key')!);
  }

  @Get('try-risk-free/authorizations/:authorizationId')
  @ApiOperation({ operationId: 'getTryRiskFreeAuthorization' })
  @ApiOkResponse({ type: TryRiskFreeAuthorizationResponseDto })
  getTryRiskFree(
    @Req() request: AuthenticatedRequest,
    @Param('authorizationId', new ParseUUIDPipe({ version: '4' })) authorizationId: string,
  ) {
    return this.service.getTryRiskFree(request.user.id, authorizationId);
  }
}
