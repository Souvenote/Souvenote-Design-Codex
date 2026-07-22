import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AssetListResponseDto, AssetResponseDto } from '../common/api-response.dto';
import { IsOptional, IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CursorPaginationQueryDto } from '../common/pagination.dto';
import { AssetsService } from './assets.service';

export class AssetListQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cardDraftId?: string;
}

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetsService) {}

  @Get()
  @ApiOperation({ operationId: 'listAssets' })
  @ApiOkResponse({ type: AssetListResponseDto })
  async list(@Req() request: AuthenticatedRequest, @Query() query: AssetListQueryDto) {
    return this.assetService.list(request.user.id, query.limit ?? 20, query.cursor, query.cardDraftId);
  }

  @Get(':assetId')
  @ApiOperation({ operationId: 'getAsset' })
  @ApiOkResponse({ type: AssetResponseDto })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('assetId', new ParseUUIDPipe({ version: '4' })) assetId: string,
  ) {
    return this.assetService.get(request.user.id, assetId);
  }
}
