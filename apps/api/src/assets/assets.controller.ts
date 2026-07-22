import { Controller, Get, Param } from '@nestjs/common';
import { AssetsServices } from './assets.service';
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetsServices) {}

  @Get('card-draft/:cardDraftId')
  async getCardDraftId(@Param('cardDraftId') cardDraftId: string) {
    return this.assetService.getCardDraft(cardDraftId);
  }
}
