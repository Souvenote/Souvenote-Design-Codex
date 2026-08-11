import { Controller, Get, Param, ParseUUIDPipe, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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

  @Get(':assetId/content')
  @ApiOperation({ operationId: 'getAssetContent' })
  @ApiProduces('image/svg+xml', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'text/plain')
  async content(
    @Req() request: AuthenticatedRequest,
    @Param('assetId', new ParseUUIDPipe({ version: '4' })) assetId: string,
    @Res() response: Response,
  ) {
    const asset = await this.assetService.content(request.user.id, assetId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Type': asset.mediaType,
      'Content-Length': String(asset.content.length),
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(asset.content);
  }
}
