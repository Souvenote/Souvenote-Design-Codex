"use client";

import type {
  CardDraftAsset,
  CheckoutSession,
  FulfillmentRecord,
  Order,
} from "./api";

export type MockMvpFlowState = {
  cardDraftId: string | null;
  generatedAssets: CardDraftAsset[];
  selectedAssetId: string | null;
  orderId: string | null;
  orderStatus: string | null;
  checkoutSessionId: string | null;
  paymentId: string | null;
  fulfillment: FulfillmentRecord | null;
  updatedAt: string | null;
};

export const MOCK_MVP_FLOW_STORAGE_KEY = "souv_mock_mvp_flow";
export const MOCK_MVP_FLOW_UPDATED_EVENT = "souv-mock-mvp-flow-updated";

const EMPTY_FLOW_STATE: MockMvpFlowState = {
  cardDraftId: null,
  generatedAssets: [],
  selectedAssetId: null,
  orderId: null,
  orderStatus: null,
  checkoutSessionId: null,
  paymentId: null,
  fulfillment: null,
  updatedAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function assetType(asset: CardDraftAsset): string {
  return String(asset.assetType || asset.asset_type || "").toLowerCase();
}

export function readMockMvpFlowState(): MockMvpFlowState {
  if (typeof window === "undefined") return EMPTY_FLOW_STATE;

  try {
    const raw = window.localStorage.getItem(MOCK_MVP_FLOW_STORAGE_KEY);
    if (!raw) return EMPTY_FLOW_STATE;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return EMPTY_FLOW_STATE;

    return {
      cardDraftId: textValue(parsed.cardDraftId),
      generatedAssets: Array.isArray(parsed.generatedAssets)
        ? (parsed.generatedAssets.filter(isRecord) as CardDraftAsset[])
        : [],
      selectedAssetId: textValue(parsed.selectedAssetId),
      orderId: textValue(parsed.orderId),
      orderStatus: textValue(parsed.orderStatus),
      checkoutSessionId: textValue(parsed.checkoutSessionId),
      paymentId: textValue(parsed.paymentId),
      fulfillment: isRecord(parsed.fulfillment)
        ? (parsed.fulfillment as FulfillmentRecord)
        : null,
      updatedAt: textValue(parsed.updatedAt),
    };
  } catch {
    return EMPTY_FLOW_STATE;
  }
}

export function writeMockMvpFlowState(
  patch: Partial<MockMvpFlowState>,
): MockMvpFlowState {
  const next: MockMvpFlowState = {
    ...readMockMvpFlowState(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      MOCK_MVP_FLOW_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent(MOCK_MVP_FLOW_UPDATED_EVENT, { detail: next }),
    );
  }

  return next;
}

export function resetMockMvpOrderState(
  cardDraftId: string | null,
): MockMvpFlowState {
  return writeMockMvpFlowState({
    cardDraftId,
    generatedAssets: [],
    selectedAssetId: null,
    orderId: null,
    orderStatus: null,
    checkoutSessionId: null,
    paymentId: null,
    fulfillment: null,
  });
}

export function rememberGeneratedAssets(
  cardDraftId: string,
  assets: CardDraftAsset[],
): MockMvpFlowState {
  const imageAsset = findGeneratedImageAsset(assets);

  return writeMockMvpFlowState({
    cardDraftId,
    generatedAssets: assets,
    selectedAssetId: imageAsset?.id || null,
    orderId: null,
    orderStatus: null,
    checkoutSessionId: null,
    paymentId: null,
    fulfillment: null,
  });
}

export function rememberSelectedAsset(
  cardDraftId: string,
  selectedAssetId: string,
  assets: CardDraftAsset[] = [],
) {
  return writeMockMvpFlowState({
    cardDraftId,
    selectedAssetId,
    generatedAssets: assets.length
      ? assets
      : readMockMvpFlowState().generatedAssets,
  });
}

export function rememberCheckoutResult(
  order: Order,
  checkoutSession?: CheckoutSession | null,
) {
  const current = readMockMvpFlowState();

  return writeMockMvpFlowState({
    cardDraftId: order.cardDraftId || current.cardDraftId,
    selectedAssetId: order.selectedAssetId || current.selectedAssetId,
    orderId: order.id,
    orderStatus: order.status,
    checkoutSessionId: checkoutSession?.id || order.checkoutSessionId || null,
    paymentId: checkoutSession?.paymentId || order.paymentId || null,
    fulfillment: current.orderId === order.id ? current.fulfillment : null,
  });
}

export function rememberFulfillmentResult(
  order: Order,
  fulfillment: FulfillmentRecord,
) {
  return writeMockMvpFlowState({
    cardDraftId: order.cardDraftId || readMockMvpFlowState().cardDraftId,
    selectedAssetId:
      order.selectedAssetId || readMockMvpFlowState().selectedAssetId,
    orderId: order.id,
    orderStatus: order.status,
    checkoutSessionId:
      order.checkoutSessionId || readMockMvpFlowState().checkoutSessionId,
    paymentId: order.paymentId || readMockMvpFlowState().paymentId,
    fulfillment,
  });
}

export function findGeneratedImageAsset(
  assets: CardDraftAsset[],
): CardDraftAsset | null {
  return findGeneratedAsset(assets, "image");
}

export function findGeneratedAsset(
  assets: CardDraftAsset[],
  type: string,
): CardDraftAsset | null {
  const matchingAssets = assets.filter((asset) => assetType(asset) === type);
  return matchingAssets[matchingAssets.length - 1] || null;
}

export function hasGeneratedAsset(
  assets: CardDraftAsset[],
  type: string,
): boolean {
  return assets.some((asset) => assetType(asset) === type);
}
