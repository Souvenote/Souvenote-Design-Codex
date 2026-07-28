import { Injectable } from '@nestjs/common';
import {
  type GenerationAssetType,
  type GenerationProvider,
  type GenerationProviderPollRequest,
  type GenerationProviderRequest,
  type GenerationProviderResult,
  type ProviderGeneratedAsset,
} from './generation.provider';

@Injectable()
export class MockGenerationProvider implements GenerationProvider {
  readonly mode = 'mock';
  readonly acceptsReferenceImages = false;

  async start(request: GenerationProviderRequest) {
    await Promise.resolve();
    return {
      status: 'completed' as const,
      result: this.createResult(request),
    };
  }

  async poll(request: GenerationProviderPollRequest) {
    await Promise.resolve();
    return {
      status: 'completed' as const,
      result: this.createResult(request),
    };
  }

  private createResult(
    request: GenerationProviderRequest,
  ): GenerationProviderResult {
    const assets = request.assetTypes.map((assetType) =>
      this.createAsset(request.generationJobId, assetType),
    );

    return {
      providerMode: this.mode,
      providerJobRefs: { mockJobId: request.generationJobId },
      resultMetadata: {
        completedSynchronously: true,
        assetCount: assets.length,
      },
      assets,
    };
  }

  private createAsset(
    generationJobId: string,
    assetType: GenerationAssetType,
  ): ProviderGeneratedAsset {
    const fileName = {
      image: 'card-image.png',
      song: 'song.mp3',
      message: 'inside-message.txt',
    }[assetType];
    const storageKey = `mock/generation/${generationJobId}/${fileName}`;

    return {
      assetType,
      source: { kind: 'stored', storageKey },
      metadata: {
        source: 'mock_generation',
        mockUrl: `mock://souvenote/${storageKey}`,
        ...(assetType === 'message'
          ? {
              text: 'Happy birthday! This Souvenote message was generated in mock mode.',
            }
          : {}),
      },
    };
  }
}
