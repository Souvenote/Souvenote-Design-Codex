import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GenerationProvider } from './generation.provider';
import { FalGenerationProvider } from './fal-generation.provider';
import { MockGenerationProvider } from './mock-generation.provider';

@Injectable()
export class GenerationProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockGenerationProvider: MockGenerationProvider,
    private readonly falGenerationProvider: FalGenerationProvider,
  ) {}

  getActiveProvider(): GenerationProvider {
    const mode = (
      this.configService.get<string>('GENERATION_PROVIDER_MODE') ?? 'mock'
    )
      .trim()
      .toLowerCase();

    return this.getProviderForMode(mode);
  }

  getProviderForMode(mode: string): GenerationProvider {
    if (mode === this.mockGenerationProvider.mode)
      return this.mockGenerationProvider;
    if (mode === this.falGenerationProvider.mode) {
      const missing = ['FAL_KEY', 'AWS_REGION', 'AWS_S3_BUCKET_NAME'].filter(
        (key) => !this.configService.get<string>(key)?.trim(),
      );
      if (missing.length) {
        throw new InternalServerErrorException(
          `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required in fal generation mode.`,
        );
      }
      return this.falGenerationProvider;
    }

    throw new InternalServerErrorException(
      `Generation provider mode ${mode || '(empty)'} is not configured.`,
    );
  }
}
