import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { AnalyticsCapture, AnalyticsProvider } from './analytics.provider';

const OFFICIAL_POSTHOG_HOSTS = new Set([
  'https://us.i.posthog.com',
  'https://eu.i.posthog.com',
]);

@Injectable()
export class PostHogAnalyticsProvider implements AnalyticsProvider {
  readonly mode = 'posthog' as const;
  private client: PostHog | null = null;

  constructor(private readonly configService: ConfigService) {}

  assertConfigured() {
    this.configuration();
  }

  capture(event: AnalyticsCapture) {
    this.getClient().capture({
      distinctId: event.distinctId,
      uuid: event.eventId,
      event: event.event,
      properties: {
        ...event.properties,
        $process_person_profile: false,
      },
      disableGeoip: true,
    });
  }

  async shutdown() {
    if (!this.client) return;
    await this.client._shutdown(5_000);
    this.client = null;
  }

  private getClient() {
    if (this.client) return this.client;
    const configuration = this.configuration();
    this.client = new PostHog(configuration.apiKey, {
      host: configuration.host,
      flushAt: 20,
      flushInterval: 5_000,
      privacyMode: true,
      enableExceptionAutocapture: false,
    });
    return this.client;
  }

  private configuration() {
    const apiKey = this.required('POSTHOG_API_KEY');
    if (!/^phc_[A-Za-z0-9_-]{10,200}$/.test(apiKey)) {
      throw new InternalServerErrorException(
        'POSTHOG_API_KEY must be a PostHog project API key.',
      );
    }

    const host = (
      this.configService.get<string>('POSTHOG_HOST') ??
      'https://us.i.posthog.com'
    )
      .trim()
      .replace(/\/+$/, '');
    if (!OFFICIAL_POSTHOG_HOSTS.has(host)) {
      throw new InternalServerErrorException(
        'POSTHOG_HOST must be an official PostHog US or EU ingestion endpoint.',
      );
    }

    return { apiKey, host };
  }

  private required(name: string) {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${name} is required.`);
    }
    return value;
  }
}
