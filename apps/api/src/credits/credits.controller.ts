import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreditsService } from './credits.service';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreditBalanceResponseDto } from '../common/api-response.dto';

@ApiTags('credits')
@ApiBearerAuth()
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  @ApiOperation({ operationId: 'getCreditBalance' })
  @ApiOkResponse({ type: CreditBalanceResponseDto })
  async getBalance(@Req() request: AuthenticatedRequest) {
    return this.creditsService.findBalance(request.user.id);
  }
}
