import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FulfillmentRecord, Order } from "./api";
import {
  API_BASE_URL,
  completeMockCreditPackCheckout,
  fetchCreditPackPurchase,
  fetchFulfillments,
  fetchPublicSouvenote,
  fetchUserOrders,
  startCreditPackCheckout,
  uploadReferenceImage,
} from "./api";

const authMocks = vi.hoisted(() => ({
  getActiveCognitoSession: vi.fn(),
  getStoredLocalUser: vi.fn(),
}));

vi.mock("./cognitoAuth", () => authMocks);

function response(
  payload: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function order(id = "order-1"): Order {
  return {
    id,
    userId: "user-1",
    cardDraftId: "draft-1",
    selectedAssetId: "asset-1",
    status: "paid",
  };
}

function fulfillment(id = "fulfillment-1"): FulfillmentRecord {
  return {
    id,
    orderId: "order-1",
    userId: "user-1",
    status: "submitted",
  };
}

describe("owner-scoped order and fulfillment API contracts", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    authMocks.getActiveCognitoSession.mockResolvedValue({
      idToken: "test-id-token",
      accessToken: "test-access-token",
      expiresAt: Date.now() + 60_000,
      email: "owner@example.com",
      sub: "user-1",
    });
    authMocks.getStoredLocalUser.mockReturnValue(null);
  });

  it("lists orders through the authenticated owner endpoint", async () => {
    const expectedOrder = order();
    fetchMock.mockResolvedValue(
      response({ userId: "user-1", orders: [expectedOrder] }),
    );

    await expect(fetchUserOrders()).resolves.toEqual([expectedOrder]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/orders`);
    expect(init).toMatchObject({
      method: "GET",
      cache: "no-store",
    });
    expect(new URL(String(url)).searchParams.has("userId")).toBe(false);

    const headers = init?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-id-token");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("rejects incomplete order-list payloads", async () => {
    fetchMock.mockResolvedValue(
      response({ userId: "user-1", orders: [{}] }),
    );

    await expect(fetchUserOrders()).rejects.toThrow(
      "Order list response was incomplete.",
    );
  });

  it("adds only validated request IDs to API errors", async () => {
    const requestId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    fetchMock.mockResolvedValue(
      response(
        { message: "Order backend failed." },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId.toUpperCase(),
          },
        },
      ),
    );

    await expect(fetchUserOrders()).rejects.toThrow(
      `Order backend failed. Support code: ${requestId}.`,
    );
  });

  it("loads fulfillments from the encoded owner-scoped order path", async () => {
    const orderId = "order /?#";
    const expectedFulfillment = {
      ...fulfillment(),
      orderId,
    };
    fetchMock.mockResolvedValue(
      response({
        orderId,
        fulfillments: [expectedFulfillment],
      }),
    );

    await expect(fetchFulfillments(orderId)).resolves.toEqual([
      expectedFulfillment,
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE_URL}/fulfillment/order/${encodeURIComponent(orderId)}`,
    );
    expect(init).toMatchObject({
      method: "GET",
      cache: "no-store",
    });
    expect((init?.headers as Headers).get("Authorization")).toBe(
      "Bearer test-id-token",
    );
  });

  it("treats a missing fulfillment collection as not submitted yet", async () => {
    fetchMock.mockResolvedValue(
      response(
        { message: "No fulfillment found." },
        { status: 404 },
      ),
    );

    await expect(fetchFulfillments("order-1")).resolves.toEqual([]);
  });

  it("rejects a fulfillment response for a different order", async () => {
    fetchMock.mockResolvedValue(
      response({
        orderId: "another-order",
        fulfillments: [fulfillment()],
      }),
    );

    await expect(fetchFulfillments("order-1")).rejects.toThrow(
      "Fulfillment lookup response was incomplete.",
    );
  });
});

describe("upload and public-read authentication boundaries", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    authMocks.getActiveCognitoSession.mockResolvedValue({
      idToken: "test-id-token",
      accessToken: "test-access-token",
      expiresAt: Date.now() + 60_000,
      email: "owner@example.com",
      sub: "user-1",
    });
    authMocks.getStoredLocalUser.mockReturnValue(null);
  });

  it("keeps the Cognito token off the presigned storage request", async () => {
    const filename = "reference.png";
    const mimeType = "image/png";
    const file = new File(["reference-image"], filename, { type: mimeType });
    const storageUrl = "https://uploads.example.test/presigned";
    const uploadRequest = {
      id: "upload-1",
      userId: "user-1",
      cardDraftId: "draft-1",
      filename,
      mimeType,
      size: file.size,
      status: "requested",
      storageKey: "users/user-1/drafts/draft-1/reference.png",
      providerMode: "s3",
      uploadMethod: "POST",
      uploadUrl: storageUrl,
      formFields: {
        key: "users/user-1/drafts/draft-1/reference.png",
        policy: "signed-policy",
      },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      maxSizeBytes: 5_000_000,
    };
    const committedUpload = {
      ...uploadRequest,
      status: "uploaded",
    };

    fetchMock
      .mockResolvedValueOnce(response({ uploadRequest }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(response({ upload: committedUpload }));

    await expect(
      uploadReferenceImage({
        cardDraftId: "draft-1",
        filename,
        mimeType,
        size: file.size,
        file,
      }),
    ).resolves.toEqual({ upload: committedUpload });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    const [storageRequestUrl, storageInit] = fetchMock.mock.calls[1];
    const [commitUrl, commitInit] = fetchMock.mock.calls[2];

    expect(requestUrl).toBe(`${API_BASE_URL}/uploads/request`);
    expect((requestInit?.headers as Headers).get("Authorization")).toBe(
      "Bearer test-id-token",
    );
    expect(storageRequestUrl).toBe(storageUrl);
    expect(storageInit?.headers).toBeUndefined();
    expect(storageInit?.body).toBeInstanceOf(FormData);
    expect(commitUrl).toBe(`${API_BASE_URL}/uploads/commit`);
    expect((commitInit?.headers as Headers).get("Authorization")).toBe(
      "Bearer test-id-token",
    );
  });

  it("keeps public Souvenote reads anonymous and suppresses the referrer", async () => {
    const token = "public/token?#";
    const publicSouvenote = {
      occasion: "Birthday",
      imageUrl: "https://media.example.test/image",
      songUrl: "https://media.example.test/song",
      insideMessage: "Happy birthday",
      assetUrlExpiresInSeconds: 300,
    };
    fetchMock.mockResolvedValue(response(publicSouvenote));

    await expect(fetchPublicSouvenote(token)).resolves.toEqual(publicSouvenote);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE_URL}/public/souvenotes/${encodeURIComponent(token)}`,
    );
    expect(init).toEqual({
      method: "GET",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    expect(authMocks.getActiveCognitoSession).not.toHaveBeenCalled();
  });
});

describe("standalone credit-pack API contracts", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const purchase = {
    id: "credit-purchase-1",
    offerCode: "credit_pack_creator_80",
    status: "checkout_started",
    amountCents: 1000,
    currency: "cad",
    creditAmount: 80,
  };
  const checkoutSession = {
    id: "cs_credit_1",
    creditPackPurchaseId: purchase.id,
    paymentId: "payment-credit-1",
    providerMode: "stripe",
    status: "checkout_started",
    captureMethod: "automatic_async",
    amountCents: 1000,
    currency: "cad",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    authMocks.getActiveCognitoSession.mockResolvedValue({
      idToken: "test-id-token",
      accessToken: "test-access-token",
      expiresAt: Date.now() + 60_000,
      email: "owner@example.com",
      sub: "user-1",
    });
    authMocks.getStoredLocalUser.mockReturnValue(null);
  });

  it("starts a server-priced CAD checkout with an idempotency key", async () => {
    fetchMock.mockResolvedValue(
      response({ checkoutSession, purchase }),
    );

    await expect(
      startCreditPackCheckout(
        "credit_pack_creator_80",
        "credit-request-123",
      ),
    ).resolves.toMatchObject({
      purchase: {
        amountCents: 1000,
        currency: "cad",
        creditAmount: 80,
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/checkout/credit-packs/start`);
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        offerCode: "credit_pack_creator_80",
        idempotencyKey: "credit-request-123",
      }),
    });
    expect((init?.headers as Headers).get("Authorization")).toBe(
      "Bearer test-id-token",
    );
  });

  it("accepts mock completion only when the purchase is paid", async () => {
    fetchMock.mockResolvedValue(
      response({
        checkoutSession: { ...checkoutSession, status: "paid_mock" },
        purchase: { ...purchase, status: "paid" },
        balance: { balance: 80 },
      }),
    );

    await expect(
      completeMockCreditPackCheckout(purchase.id, checkoutSession.id),
    ).resolves.toMatchObject({
      purchase: { id: purchase.id, status: "paid" },
      balance: { balance: 80 },
    });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      body: JSON.stringify({
        purchaseId: purchase.id,
        checkoutSessionId: checkoutSession.id,
      }),
    });
  });

  it("loads the encoded owner purchase path without caching", async () => {
    const purchaseId = "credit /?#";
    fetchMock.mockResolvedValue(
      response({
        purchase: { ...purchase, id: purchaseId, status: "paid" },
        balance: { balance: 80 },
      }),
    );

    await expect(fetchCreditPackPurchase(purchaseId)).resolves.toMatchObject({
      purchase: { id: purchaseId, status: "paid" },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE_URL}/credits/purchases/${encodeURIComponent(purchaseId)}`,
    );
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect((init?.headers as Headers).get("Authorization")).toBe(
      "Bearer test-id-token",
    );
  });
});
