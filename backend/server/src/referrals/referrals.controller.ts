import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PublicRoute } from '../auth/public-route.decorator';
import { ReferralsService } from './referrals.service';

class CreateReferralInviteDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @Length(8, 255)
  idempotencyKey: string;
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.referralsService.dashboard(request.localUser.id);
  }

  @Post('invites')
  createInvite(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReferralInviteDto,
  ) {
    return this.referralsService.createInvite(request.localUser.id, dto);
  }

  @PublicRoute()
  @Get('claim/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  preview(@Param('token') token: string) {
    return this.referralsService.preview(token);
  }

  @Post('claim/:token')
  claim(@Req() request: AuthenticatedRequest, @Param('token') token: string) {
    return this.referralsService.claim(request.localUser.id, token);
  }
}
