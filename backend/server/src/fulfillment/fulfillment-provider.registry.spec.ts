import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FulfillmentProviderRegistry } from './fulfillment-provider.registry';
import { MockFulfillmentProvider } from './mock-fulfillment.provider';
import { ScribelessFulfillmentProvider } from './scribeless-fulfillment.provider';

describe('FulfillmentProviderRegistry', () => {
  const values: Record<string, string | undefined> = {};
  const registry = new FulfillmentProviderRegistry(
    {
      get: (key: string) => values[key],
    } as unknown as ConfigService,
    { mode: 'mock' } as MockFulfillmentProvider,
    { mode: 'scribeless' } as ScribelessFulfillmentProvider,
  );

  afterEach(() => {
    delete values.FULFILLMENT_PROVIDER_MODE;
  });

  it('defaults to mock and selects Scribeless explicitly', () => {
    expect(registry.getActiveProvider().mode).toBe('mock');
    values.FULFILLMENT_PROVIDER_MODE = 'scribeless';
    expect(registry.getActiveProvider().mode).toBe('scribeless');
  });

  it('rejects an unsupported provider mode', () => {
    values.FULFILLMENT_PROVIDER_MODE = 'mail-it-yourself';
    expect(() => registry.getActiveProvider()).toThrow(
      InternalServerErrorException,
    );
  });
});
