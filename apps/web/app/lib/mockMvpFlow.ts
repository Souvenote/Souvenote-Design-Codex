'use client';

import type { CardDraftAsset } from './api';

export type MockMvpFlowState = {
  cardDraftId: string | null;
  generatedAssets: CardDraftAsset[];
  selectedAssetId: string | null;
  updatedAt: string | null;
};

export const MOCK_MVP_FLOW_UPDATED_EVENT = 'souv-mock-mvp-flow-updated';

const EMPTY_FLOW_STATE: MockMvpFlowState = {
  cardDraftId: null,
  generatedAssets: [],
  selectedAssetId: null,
  updatedAt: null,
};

let activeFlowState: MockMvpFlowState = { ...EMPTY_FLOW_STATE };

function assetType(asset: CardDraftAsset): string {
  return String(asset.assetType || asset.asset_type || '').toLowerCase();
}

export function readMockMvpFlowState(): MockMvpFlowState {
  return { ...activeFlowState, generatedAssets: [...activeFlowState.generatedAssets] };
}

export function writeMockMvpFlowState(patch: Partial<MockMvpFlowState>): MockMvpFlowState {
  const next: MockMvpFlowState = {
    ...activeFlowState,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  activeFlowState = next;
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent(MOCK_MVP_FLOW_UPDATED_EVENT, { detail: next }));

  return next;
}

export function resetMockMvpOrderState(cardDraftId: string | null): MockMvpFlowState {
  return writeMockMvpFlowState({
    cardDraftId,
    generatedAssets: [],
    selectedAssetId: null,
  });
}

export function rememberGeneratedAssets(cardDraftId: string, assets: CardDraftAsset[]): MockMvpFlowState {
  const imageAsset = findGeneratedImageAsset(assets);

  return writeMockMvpFlowState({
    cardDraftId,
    generatedAssets: assets,
    selectedAssetId: imageAsset?.id || null,
  });
}

export function rememberSelectedAsset(cardDraftId: string, selectedAssetId: string, assets: CardDraftAsset[] = []) {
  return writeMockMvpFlowState({
    cardDraftId,
    selectedAssetId,
    generatedAssets: assets.length ? assets : readMockMvpFlowState().generatedAssets,
  });
}

export function findGeneratedImageAsset(assets: CardDraftAsset[]): CardDraftAsset | null {
  const imageAssets = assets.filter((asset) => assetType(asset) === 'image');
  return imageAssets[imageAssets.length - 1] || null;
}

export function hasGeneratedAsset(assets: CardDraftAsset[], type: string): boolean {
  return assets.some((asset) => assetType(asset) === type);
}
