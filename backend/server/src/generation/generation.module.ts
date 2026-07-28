import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { CreditsModule } from '../credits/credits.module';
import { UploadModule } from '../uploads/upload.module';
import {
  defaultGenerationFetch,
  GENERATION_FETCH,
  GenerationAssetStorageService,
} from './generation-asset-storage.service';
import { GenerationProviderRegistry } from './generation-provider.registry';
import {
  createFalGenerationClient,
  FAL_CLIENT,
  FalGenerationProvider,
} from './fal-generation.provider';
import { MockGenerationProvider } from './mock-generation.provider';

@Module({
  controllers: [GenerationController],
  providers: [
    GenerationService,
    GenerationProviderRegistry,
    MockGenerationProvider,
    FalGenerationProvider,
    GenerationAssetStorageService,
    {
      provide: FAL_CLIENT,
      inject: [ConfigService],
      useFactory: createFalGenerationClient,
    },
    {
      provide: GENERATION_FETCH,
      useValue: defaultGenerationFetch,
    },
  ],
  imports: [CreditsModule, UploadModule],
})
export class GenerationModule {}
