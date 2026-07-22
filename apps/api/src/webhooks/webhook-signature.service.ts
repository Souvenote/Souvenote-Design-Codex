import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readString } from '../config/runtime-config';

export type WebhookProvider = 'stripe' | 'scribeless';

@Injectable()
export class WebhookSignatureService {
  constructor(private readonly config: ConfigService) {}

  verify(provider: WebhookProvider, body: Buffer, supplied: string | undefined): void {
    if (!supplied || supplied.length > 2_048) throw new UnauthorizedException('Webhook signature is missing.');
    if (provider === 'stripe') return this.verifyStripe(body, supplied);
    return this.verifyScribeless(body, supplied);
  }

  private verifyStripe(body: Buffer, supplied: string): void {
    const secret = this.secret('STRIPE_WEBHOOK_SECRET');
    const values = new Map(
      supplied.split(',').map((part) => {
        const separator = part.indexOf('=');
        return separator > 0 ? [part.slice(0, separator), part.slice(separator + 1)] : ['', ''];
      }),
    );
    const timestamp = values.get('t') ?? '';
    const signature = values.get('v1') ?? '';
    const timestampSeconds = Number(timestamp);
    if (!Number.isInteger(timestampSeconds) || Math.abs(Date.now() / 1_000 - timestampSeconds) > 300) {
      throw new UnauthorizedException('Webhook signature is invalid.');
    }
    const expected = createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex');
    this.compare(signature, expected);
  }

  private verifyScribeless(body: Buffer, supplied: string): void {
    const secret = this.secret('SCRIBELESS_WEBHOOK_SECRET');
    const signature = supplied.startsWith('sha256=') ? supplied.slice('sha256='.length) : supplied;
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    this.compare(signature, expected);
  }

  private compare(supplied: string, expected: string): void {
    const left = Buffer.from(supplied, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Webhook signature is invalid.');
    }
  }

  private secret(name: string): string {
    const value = readString(this.config, name);
    if (!value || value.length < 16) {
      throw new ServiceUnavailableException('Webhook verification is not configured.');
    }
    return value;
  }
}
