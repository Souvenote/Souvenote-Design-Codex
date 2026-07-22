import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookReceiptResponseDto } from '../common/api-response.dto';
import type { Request } from 'express';
import { Public } from '../common/public.decorator';
import { WebhooksService } from './webhooks.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post('stripe')
  @ApiOperation({
    operationId: 'receiveStripeWebhook',
    description: 'Signature verified. Stripe event id is the provider idempotency key; duplicate payloads are no-ops.',
  })
  @ApiHeader({ name: 'stripe-signature', required: true, description: 'Stripe timestamped HMAC signature.' })
  @ApiCreatedResponse({ type: WebhookReceiptResponseDto })
  async stripe(
    @Req() request: RawBodyRequest,
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.receive('stripe', request.rawBody, signature, body);
  }

  @Post('scribeless')
  @ApiOperation({
    operationId: 'receiveScribelessWebhook',
    description:
      'Signature verified. Scribeless event id is the provider idempotency key; duplicate payloads are no-ops.',
  })
  @ApiHeader({ name: 'x-scribeless-signature', required: true, description: 'Scribeless HMAC-SHA256 signature.' })
  @ApiCreatedResponse({ type: WebhookReceiptResponseDto })
  async scribeless(
    @Req() request: RawBodyRequest,
    @Headers('x-scribeless-signature') signature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.receive('scribeless', request.rawBody, signature, body);
  }
}
