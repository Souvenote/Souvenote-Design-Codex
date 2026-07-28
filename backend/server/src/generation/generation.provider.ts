export type GenerationAssetType = 'image' | 'song' | 'message';

export type GenerationProviderRequest = {
  generationJobId: string;
  cardDraftId: string;
  creativeBrief: Record<string, unknown>;
  assetTypes: GenerationAssetType[];
  referenceImageUrls: string[];
};

export type GenerationProviderPollRequest = GenerationProviderRequest & {
  providerJobRefs: Record<string, unknown>;
};

export type ProviderAssetSource =
  | { kind: 'stored'; storageKey: string }
  | { kind: 'remote'; url: string; contentType?: string }
  | { kind: 'inline'; data: string; contentType: string };

export type ProviderGeneratedAsset = {
  assetType: GenerationAssetType;
  source: ProviderAssetSource;
  metadata: Record<string, unknown>;
};

export type GeneratedAssetOutput = {
  assetType: GenerationAssetType;
  storageKey: string;
  moderationState: string;
  metadata: Record<string, unknown>;
};

export type GenerationProviderResult = {
  providerMode: string;
  providerJobRefs: Record<string, unknown>;
  resultMetadata: Record<string, unknown>;
  assets: ProviderGeneratedAsset[];
};

export type GenerationProviderStartResult =
  | {
      status: 'queued';
      providerJobRefs: Record<string, unknown>;
    }
  | {
      status: 'completed';
      result: GenerationProviderResult;
    };

export type GenerationProviderPollResult =
  | {
      status: 'pending';
      providerJobRefs: Record<string, unknown>;
    }
  | {
      status: 'failed';
      errorMessage: string;
      providerJobRefs: Record<string, unknown>;
    }
  | {
      status: 'completed';
      result: GenerationProviderResult;
    };

export interface GenerationProvider {
  readonly mode: string;
  readonly acceptsReferenceImages: boolean;
  start(
    request: GenerationProviderRequest,
  ): Promise<GenerationProviderStartResult>;
  poll(
    request: GenerationProviderPollRequest,
  ): Promise<GenerationProviderPollResult>;
}
