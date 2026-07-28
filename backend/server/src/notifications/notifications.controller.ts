import {
  Controller,
  Header,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PublicRoute } from '../auth/public-route.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @PublicRoute()
  @Post('sendgrid/webhook')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  handleSendGridWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-twilio-email-event-webhook-signature') signature?: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp?: string,
  ) {
    return this.notificationsService.handleSendGridWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature ?? '',
      timestamp ?? '',
    );
  }
}
