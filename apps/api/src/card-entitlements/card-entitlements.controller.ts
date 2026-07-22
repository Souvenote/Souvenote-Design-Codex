import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardEntitlementListResponseDto } from '../common/api-response.dto';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CursorPaginationQueryDto } from '../common/pagination.dto';
import { CardEntitlementsService } from './card-entitlements.service';

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
}
