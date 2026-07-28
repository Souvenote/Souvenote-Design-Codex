import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FalGenerationProvider } from './fal-generation.provider';
import { GenerationProviderRegistry } from './generation-provider.registry';
import { MockGenerationProvider } from './mock-generation.provider';

describe('GenerationProviderRegistry', () => {
  const values: Record<string, string> = {};
  const get = jest.fn((key: string) => values[key]);
  const configService = { get } as unknown as ConfigService;
  const mockProvider = { mode: 'mock' } as MockGenerationProvider;
  const falProvider = { mode: 'fal' } as FalGenerationProvider;
  const registry = new GenerationProviderRegistry(
    configService,
    mockProvider,
    falProvider,
  );

  beforeEach(() => {
    for (const key of Object.keys(values)) delete values[key];
    get.mockClear();
  });

  it('uses mock mode by default without requiring external credentials', () => {
    expect(registry.getActiveProvider()).toBe(mockProvider);
  });

  it('requires Fal and private S3 configuration before dispatching real work', () => {
    values.GENERATION_PROVIDER_MODE = 'fal';
    values.FAL_KEY = 'server-secret';

    expect(() => registry.getActiveProvider()).toThrow(
      'AWS_REGION, AWS_S3_BUCKET_NAME are required in fal generation mode.',
    );

    values.AWS_REGION = 'us-west-2';
    values.AWS_S3_BUCKET_NAME = 'souvenote-private';
    expect(registry.getActiveProvider()).toBe(falProvider);
  });

  it('rejects unconfigured provider modes', () => {
    values.GENERATION_PROVIDER_MODE = 'unknown';

    expect(() => registry.getActiveProvider()).toThrow(
      InternalServerErrorException,
    );
  });
});
