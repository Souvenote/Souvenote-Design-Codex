import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PublicCardResponseDto } from '../common/api-response.dto';
import { Public } from '../common/public.decorator';
import { PublicCardsService } from './public-cards.service';

@ApiTags('public-cards')
@Public()
@Controller('public/cards')
export class PublicCardsController {
  constructor(private readonly service: PublicCardsService) {}

  @Get(':shareToken')
  @ApiOperation({ operationId: 'getPublicCard' })
  @ApiParam({
    name: 'shareToken',
    required: true,
    schema: { type: 'string', minLength: 32, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$' },
  })
  @ApiOkResponse({ type: PublicCardResponseDto })
  async get(@Param('shareToken') shareToken: string) {
    return this.service.get(shareToken);
  }
}
