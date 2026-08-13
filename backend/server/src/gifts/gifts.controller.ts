import { Controller, Get, Header, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PublicRoute } from '../auth/public-route.decorator';
import { GiftsService } from './gifts.service';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.giftsService.listOwnedGifts(request.localUser.id);
  }

  @PublicRoute()
  @Get('claim/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  preview(@Param('token') token: string) {
    return this.giftsService.preview(token);
  }

  @Post('claim/:token/redeem')
  redeem(@Req() request: AuthenticatedRequest, @Param('token') token: string) {
    return this.giftsService.redeem(request.localUser.id, token);
  }
}
