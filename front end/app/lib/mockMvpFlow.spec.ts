import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CardDraftAsset,
  FulfillmentRecord,
  Order,
} from "./api";
import {
  MOCK_MVP_FLOW_STORAGE_KEY,
  readMockMvpFlowState,
  rememberCheckoutResult,
  rememberFulfillmentResult,
  rememberGeneratedAssets,
} from "./mockMvpFlow";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function order(id: string): Order {
  return {
    id,
    userId: "user-1",
    cardDraftId: "draft-1",
    selectedAssetId: "image-2",
    status: "paid",
  };
}

function fulfillment(orderId: string): FulfillmentRecord {
  return {
    id: `fulfillment-${orderId}`,
    orderId,
    userId: "user-1",
    status: "submitted",
  };
}

describe("durable MVP flow state", () => {
  let storage: Storage;
  let dispatchEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMemoryStorage();
    dispatchEvent = vi.fn();
    vi.stubGlobal("window", {
      localStorage: storage,
      dispatchEvent,
    });
    vi.stubGlobal(
      "CustomEvent",
      class TestCustomEvent<T> {
        readonly type: string;
        readonly detail: T | null;

        constructor(type: string, init?: CustomEventInit<T>) {
          this.type = type;
          this.detail = init?.detail ?? null;
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when persisted state is malformed", () => {
    storage.setItem(MOCK_MVP_FLOW_STORAGE_KEY, "{not-json");

    expect(readMockMvpFlowState()).toMatchObject({
      cardDraftId: null,
      generatedAssets: [],
      selectedAssetId: null,
      orderId: null,
      fulfillment: null,
    });
  });

  it("selects the latest generated image and clears stale checkout state", () => {
    rememberCheckoutResult(order("order-before-generation"));
    const assets: CardDraftAsset[] = [
      { id: "image-1", assetType: "image" },
      { id: "song-1", assetType: "song" },
      { id: "image-2", asset_type: "IMAGE" },
    ];

    const next = rememberGeneratedAssets("draft-2", assets);

    expect(next).toMatchObject({
      cardDraftId: "draft-2",
      generatedAssets: assets,
      selectedAssetId: "image-2",
      orderId: null,
      orderStatus: null,
      checkoutSessionId: null,
      paymentId: null,
      fulfillment: null,
    });
    expect(dispatchEvent).toHaveBeenCalled();
  });

  it("does not carry fulfillment from one order into another", () => {
    const firstOrder = order("order-1");
    rememberCheckoutResult(firstOrder);
    rememberFulfillmentResult(firstOrder, fulfillment(firstOrder.id));

    const next = rememberCheckoutResult(order("order-2"));

    expect(next.orderId).toBe("order-2");
    expect(next.fulfillment).toBeNull();
    expect(readMockMvpFlowState().fulfillment).toBeNull();
  });
});
