import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FulfillmentProvider } from './fulfillment.provider';
import { MockFulfillmentProvider } from './mock-fulfillment.provider';
import { ScribelessFulfillmentProvider } from './scribeless-fulfillment.provider';

@Injectable()
export class FulfillmentProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockFulfillmentProvider,
    private readonly scribelessProvider: ScribelessFulfillmentProvider,
  ) {}

  getActiveProvider(): FulfillmentProvider {
    const mode =
      this.configService
        .get<string>('FULFILLMENT_PROVIDER_MODE')
        ?.trim()
        .toLowerCase() || 'mock';

    if (mode === 'mock') return this.mockProvider;
    if (mode === 'scribeless') return this.scribelessProvider;
    throw new InternalServerErrorException(
      'FULFILLMENT_PROVIDER_MODE must be mock or scribeless.',
    );
  }

  getProvider(mode: string): FulfillmentProvider {
    if (mode === 'mock') return this.mockProvider;
    if (mode === 'scribeless') return this.scribelessProvider;
    throw new InternalServerErrorException(
      `Stored fulfillment provider mode is unsupported: ${mode}.`,
    );
  }
}
