import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { AssetsServices } from './assets.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class ApproveAssetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  assetIds: string[];
}

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetsServices) {}

  @Get('card-draft/:cardDraftId')
  async getCardDraftId(
    @Req() request: AuthenticatedRequest,
    @Param('cardDraftId') cardDraftId: string,
  ) {
    return this.assetService.getCardDraft(request.localUser.id, cardDraftId);
  }

  @Post('card-draft/:cardDraftId/approve')
  async approveCardDraftAssets(
    @Req() request: AuthenticatedRequest,
    @Param('cardDraftId') cardDraftId: string,
    @Body() dto: ApproveAssetsDto,
  ) {
    return this.assetService.approveCardDraftAssets(
      request.localUser.id,
      cardDraftId,
      dto.assetIds,
    );
  }
}
