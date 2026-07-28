import { Controller, Get, Header, Param } from '@nestjs/common';
import { PublicRoute } from '../auth/public-route.decorator';
import { PublicCardLinksService } from './public-card-links.service';

@PublicRoute()
@Controller('public/souvenotes')
export class PublicCardLinksController {
  constructor(
    private readonly publicCardLinksService: PublicCardLinksService,
  ) {}

  @Get(':token')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  async getPublicSouvenote(@Param('token') token: string) {
    return this.publicCardLinksService.getPublicSouvenote(token);
  }
}
