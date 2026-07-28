import { getActiveCognitoSession, getStoredLocalUser } from "./cognitoAuth";
import type { LocalUser } from "./cognitoAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export type PricingOffer = {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  priceCents: number;
  currency: string;
  cardCountMin: number;
  cardCountMax: number;
  creditsPerCard: number;
  creditAmount?: number | null;
  shippingIncluded: boolean;
  metadata: Record<string, unknown>;
};

type PricingResponse = {
  data: PricingOffer[];
};

export type CreditBalance = {
  userId: string;
  balance: number;
};

export type CardDraft = {
  id: string;
  user_id: string;
  occasion?: string | null;
  relationship?: string | null;
  creative_brief?: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateCardDraftRequest = {
  occasion?: string;
  relationship?: string;
  creativeBrief?: Record<string, unknown>;
};

export type UpdateCardDraftRequest = {
  occasion?: string;
  relationship?: string;
  creativeBrief?: Record<string, unknown>;
};

type CardDraftResponse = {
  cardDraft: CardDraft;
};

type UserCardDraftsResponse = {
  userId: string;
  cardDrafts: CardDraft[];
};

export type CardDraftAsset = {
  id: string;
  user_id?: string;
  card_draft_id?: string | null;
  generation_job_id?: string | null;
  asset_type?: string;
  s3_key?: string | null;
  moderation_state?: string | null;
  approved_at?: string | null;
  print_asset_key?: string | null;
  qr_metadata?: Record<string, unknown> | null;
  created_at?: string;
  userId?: string;
  cardDraftId?: string | null;
  generationJobId?: string | null;
  assetType?: string;
  storageKey?: string | null;
  mockUrl?: string | null;
  readUrl?: string | null;
  moderationState?: string | null;
  approvedAt?: string | null;
  printAssetKey?: string | null;
  qrMetadata?: Record<string, unknown>;
  createdAt?: string | null;
};

export type MockUpload = {
  id: string;
  userId: string;
  cardDraftId: string;
  assetId?: string | null;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  attestationAccepted?: boolean;
  uploadedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  mockUrl?: string | null;
  storageKey?: string | null;
};

export type MockUploadResponse = {
  upload?: MockUpload;
  asset?: CardDraftAsset | null;
};

export type UploadReferenceImageRequest = {
  cardDraftId: string;
  filename: string;
  mimeType: string;
  size: number;
  file?: File;
};

export type UploadRequest = MockUpload & {
  providerMode: "mock" | "s3";
  uploadMethod: "MOCK" | "POST";
  uploadUrl: string;
  formFields: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
};

type UploadRequestResponse = {
  uploadRequest: UploadRequest;
};

type CardDraftAssetsResponse = {
  cardDraftId: string;
  assets: CardDraftAsset[];
};

export type StartGenerationRequest = {
  cardDraftId: string;
  idempotencyKey: string;
  assetTypes?: Array<"image" | "song" | "message">;
};

export type GenerationStartResponse = {
  generationJob?: {
    id?: string;
    credits_charged?: number;
    overall_status?: string;
    image_status?: string;
    song_status?: string;
    message_status?: string;
    [key: string]: unknown;
  };
  savedAssets?: CardDraftAsset[];
  mockAssets?: Record<string, unknown>;
  creditDeduction?: Record<string, unknown>;
  balance?: CreditBalance;
};

const GENERATION_POLL_INTERVAL_MS = 1000;
const GENERATION_POLL_ATTEMPTS = 90;

export type PostalAddress = {
  name: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  line2?: string;
};

export type CreateOrderRequest = {
  cardDraftId: string;
  selectedAssetId: string;
  offerCode?: string;
  quantity?: number;
  recipientAddress: PostalAddress;
  recipientAddresses?: PostalAddress[];
  senderAddress: PostalAddress;
};

export type Order = {
  id: string;
  userId: string;
  cardDraftId: string | null;
  selectedAssetId: string | null;
  status: string;
  offerCode?: string | null;
  amountCents?: number;
  currency?: string;
  quantity?: number;
  pricingSnapshot?: Record<string, unknown>;
  checkoutSessionId?: string | null;
  paymentId?: string | null;
  fulfillmentJobId?: string | null;
  mockFulfillmentId?: string | null;
  trackingUrl?: string | null;
  recipientAddress?: Record<string, unknown>;
  recipientAddresses?: Record<string, unknown>[];
  senderAddress?: Record<string, unknown>;
  qrCodeUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  fulfillmentStatusUpdatedAt?: string | null;
};

type OrderResponse = {
  order: Order;
};

type OrdersResponse = {
  userId: string;
  orders: Order[];
};

export type CheckoutSession = {
  id: string;
  orderId: string;
  paymentId: string;
  providerMode?: string;
  status: string;
  captureMethod?: "automatic_async" | "manual";
  amountCents?: number;
  currency?: string;
  checkoutUrl?: string;
  successUrl?: string | null;
  cancelUrl?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  expiresAt?: string | null;
};

export type CheckoutResponse = {
  checkoutSession: CheckoutSession;
  order: Order;
  idempotentReplay?: boolean;
};

export type CreditPackPurchase = {
  id: string;
  offerCode: string;
  status: string;
  amountCents: number;
  currency: string;
  creditAmount: number;
  checkoutSessionId?: string | null;
  paymentId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreditPackCheckoutSession = Omit<
  CheckoutSession,
  "orderId"
> & {
  creditPackPurchaseId: string;
};

export type CreditPackCheckoutResponse = {
  checkoutSession: CreditPackCheckoutSession;
  purchase: CreditPackPurchase;
  balance?: CreditBalance;
  idempotentReplay?: boolean;
};

export type CreditPackPurchaseResponse = {
  purchase: CreditPackPurchase;
  balance: CreditBalance;
};

export type AuthorizationFinalizationResponse = {
  order: Order;
  payment: {
    id: string;
    orderId: string | null;
    providerMode: string;
    status: string;
    captureMethod: string;
    amountCents: number;
    amountCapturedCents: number;
    currency: string;
    finalizationAction: "send" | "not_send" | null;
  };
  idempotentReplay: boolean;
};

export type FulfillmentRecord = {
  id: string;
  orderId: string;
  userId: string;
  providerMode?: string;
  mockFulfillmentId?: string;
  providerFulfillmentId?: string | null;
  providerRecipientIds?: string[];
  providerCampaignId?: string | null;
  providerStatus?: string | null;
  status: string;
  attemptNumber?: number;
  idempotencyKey?: string;
  submittedAt?: string | null;
  estimatedDelivery?: string;
  statusReason?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSyncedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
};

export type FulfillmentSubmitResponse = {
  fulfillment: FulfillmentRecord;
  order: Order;
};

type FulfillmentListResponse = {
  orderId: string;
  fulfillments: FulfillmentRecord[];
};

export type PublicSouvenote = {
  occasion: string | null;
  imageUrl: string;
  songUrl: string;
  insideMessage: string | null;
  assetUrlExpiresInSeconds: number;
};

export type AuthMeResponse = {
  user: LocalUser;
  paymentMethods?: PaymentMethod[];
  starterCredits?: {
    granted?: boolean;
    balance?: CreditBalance;
  };
};

export type UserProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthday?: string;
  country?: string;
  currency?: string;
  language?: string;
  marketingOptIn?: boolean;
  preferences?: Record<string, unknown>;
};

export type PaymentMethod = {
  id: string;
  user_id: string;
  stripe_payment_method_id?: string | null;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  billing_name?: string | null;
  billing_postal_code?: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SavePaymentMethodRequest = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  billingName?: string;
  billingPostalCode?: string;
  stripePaymentMethodId?: string;
  isDefault?: boolean;
};

type PaymentMethodsResponse = {
  paymentMethods: PaymentMethod[];
};

type PaymentMethodResponse = {
  paymentMethod: PaymentMethod;
};

export const CARD_DRAFTS_UPDATED_EVENT = "souv-card-drafts-updated";

const API_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function buildApiHeaders(headers?: HeadersInit, json = false) {
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has("Accept")) nextHeaders.set("Accept", "application/json");
  if (json && !nextHeaders.has("Content-Type"))
    nextHeaders.set("Content-Type", "application/json");

  const session = await getActiveCognitoSession();
  if (session?.idToken) {
    nextHeaders.set("Authorization", `Bearer ${session.idToken}`);
  }

  return nextHeaders;
}

async function readErrorMessage(response: Response, fallback: string) {
  let message = fallback;
  try {
    const payload = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };
    if (typeof payload.message === "string") message = payload.message;
    else if (
      Array.isArray(payload.message) &&
      typeof payload.message[0] === "string"
    )
      message = payload.message[0];
    else if (typeof payload.error === "string") message = payload.error;
  } catch {
    // Keep the original fallback when the server does not return JSON.
  }

  const requestId = response.headers.get("X-Request-ID")?.trim().toLowerCase();
  return requestId && API_REQUEST_ID_PATTERN.test(requestId)
    ? `${message} Support code: ${requestId}.`
    : message;
}

export async function fetchPricingOffers(): Promise<PricingOffer[]> {
  const response = await fetch(`${API_BASE_URL}/pricing`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Pricing request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PricingResponse>;

  if (!Array.isArray(payload.data)) {
    throw new Error("Pricing response did not include a data array.");
  }

  return payload.data;
}

export async function fetchAuthenticatedUser(): Promise<LocalUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Authenticated user request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<AuthMeResponse>;
  if (
    typeof payload.user?.id !== "string" ||
    typeof payload.user.email !== "string"
  ) {
    throw new Error(
      "Authenticated user response did not include a local user id.",
    );
  }

  return payload.user;
}

export async function updateAuthenticatedUser(
  input: UserProfileUpdate,
): Promise<LocalUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Profile update failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<AuthMeResponse>;
  if (
    typeof payload.user?.id !== "string" ||
    typeof payload.user.email !== "string"
  ) {
    throw new Error("Profile update response did not include a local user.");
  }

  return payload.user;
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Payment methods request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodsResponse>;
  if (!Array.isArray(payload.paymentMethods)) {
    throw new Error(
      "Payment methods response did not include a paymentMethods array.",
    );
  }

  return payload.paymentMethods;
}

export async function createPaymentMethod(
  input: SavePaymentMethodRequest,
): Promise<PaymentMethod> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Payment method save failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodResponse>;
  if (!payload.paymentMethod?.id) {
    throw new Error("Payment method response did not include a saved method.");
  }

  return payload.paymentMethod;
}

export async function updatePaymentMethod(
  paymentMethodId: string,
  input: SavePaymentMethodRequest,
): Promise<PaymentMethod> {
  const response = await fetch(
    `${API_BASE_URL}/auth/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    {
      method: "PATCH",
      headers: await buildApiHeaders(undefined, true),
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Payment method update failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodResponse>;
  if (!payload.paymentMethod?.id) {
    throw new Error(
      "Payment method response did not include an updated method.",
    );
  }

  return payload.paymentMethod;
}

export async function deletePaymentMethod(
  paymentMethodId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/auth/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    {
      method: "DELETE",
      headers: await buildApiHeaders(),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Payment method delete failed with status ${response.status}.`,
    );
    throw new Error(message);
  }
}

export async function fetchCreditBalance(): Promise<CreditBalance> {
  const response = await fetch(`${API_BASE_URL}/credits/balance`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Credit balance request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CreditBalance>;

  if (
    typeof payload.userId !== "string" ||
    typeof payload.balance !== "number" ||
    !Number.isFinite(payload.balance)
  ) {
    throw new Error("Credit balance response did not include a valid balance.");
  }

  return {
    userId: payload.userId,
    balance: payload.balance,
  };
}

export async function createCardDraft({
  occasion,
  relationship,
  creativeBrief,
}: CreateCardDraftRequest): Promise<CardDraft> {
  const response = await fetch(`${API_BASE_URL}/card-drafts`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      ...(occasion ? { occasion } : {}),
      ...(relationship ? { relationship } : {}),
      creativeBrief: creativeBrief ?? {},
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Card draft request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftResponse>;
  if (!payload.cardDraft?.id) {
    throw new Error("Card draft response did not include a draft id.");
  }

  return payload.cardDraft;
}

export async function fetchCardDraftById(
  cardDraftId: string,
): Promise<CardDraft> {
  const response = await fetch(
    `${API_BASE_URL}/card-drafts/${encodeURIComponent(cardDraftId)}`,
    {
      headers: await buildApiHeaders(),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Card draft request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftResponse>;
  if (!payload.cardDraft?.id) {
    throw new Error("Card draft response did not include a draft id.");
  }

  return payload.cardDraft;
}

export async function updateCardDraft(
  cardDraftId: string,
  { occasion, relationship, creativeBrief }: UpdateCardDraftRequest,
): Promise<CardDraft> {
  const response = await fetch(
    `${API_BASE_URL}/card-drafts/${encodeURIComponent(cardDraftId)}`,
    {
      method: "PATCH",
      headers: await buildApiHeaders(undefined, true),
      body: JSON.stringify({
        ...(occasion ? { occasion } : {}),
        ...(relationship ? { relationship } : {}),
        ...(creativeBrief ? { creativeBrief } : {}),
      }),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Card draft update failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftResponse>;
  if (!payload.cardDraft?.id) {
    throw new Error("Card draft update response did not include a draft id.");
  }

  return payload.cardDraft;
}

export async function fetchUserCardDrafts(): Promise<CardDraft[]> {
  const response = await fetch(`${API_BASE_URL}/card-drafts`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Card drafts request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<UserCardDraftsResponse>;
  if (!Array.isArray(payload.cardDrafts)) {
    throw new Error("Card drafts response did not include a cardDrafts array.");
  }

  return payload.cardDrafts;
}

export async function fetchCardDraftAssets(
  cardDraftId: string,
): Promise<CardDraftAsset[]> {
  const response = await fetch(
    `${API_BASE_URL}/assets/card-draft/${encodeURIComponent(cardDraftId)}`,
    {
      headers: await buildApiHeaders(),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Card draft assets request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftAssetsResponse>;
  if (!Array.isArray(payload.assets)) {
    throw new Error(
      "Card draft assets response did not include an assets array.",
    );
  }

  return payload.assets;
}

export async function approveCardDraftAssets(
  cardDraftId: string,
  assetIds: string[],
): Promise<CardDraftAsset[]> {
  const response = await fetch(
    `${API_BASE_URL}/assets/card-draft/${encodeURIComponent(cardDraftId)}/approve`,
    {
      method: "POST",
      headers: await buildApiHeaders(undefined, true),
      body: JSON.stringify({ assetIds }),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Asset approval failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftAssetsResponse>;
  if (
    !Array.isArray(payload.assets) ||
    payload.assets.length !== assetIds.length
  ) {
    throw new Error(
      "Asset approval response did not include every approved asset.",
    );
  }

  return payload.assets;
}

export async function uploadReferenceImage({
  cardDraftId,
  filename,
  mimeType,
  size,
  file,
}: UploadReferenceImageRequest): Promise<MockUploadResponse> {
  const requestResponse = await fetch(`${API_BASE_URL}/uploads/request`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      cardDraftId,
      filename,
      contentType: mimeType,
      fileSizeBytes: size,
    }),
  });

  if (!requestResponse.ok) {
    const message = await readErrorMessage(
      requestResponse,
      `Upload request failed with status ${requestResponse.status}.`,
    );
    throw new Error(message);
  }

  const requestPayload =
    (await requestResponse.json()) as Partial<UploadRequestResponse>;
  const uploadRequest = requestPayload.uploadRequest;
  if (!uploadRequest?.storageKey || !uploadRequest.uploadUrl) {
    throw new Error(
      "Upload request response did not include a storage target.",
    );
  }

  if (uploadRequest.providerMode === "s3") {
    if (uploadRequest.uploadMethod !== "POST") {
      throw new Error(
        "The configured upload provider returned an unsupported upload method.",
      );
    }
    if (!file) {
      throw new Error(
        "Choose the reference image again before uploading this saved draft.",
      );
    }
    if (
      file.size !== size ||
      file.type.trim().toLowerCase() !== mimeType.trim().toLowerCase()
    ) {
      throw new Error(
        "The selected image no longer matches its upload request.",
      );
    }

    const formData = new FormData();
    Object.entries(uploadRequest.formFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append("file", file, filename);

    const storageResponse = await fetch(uploadRequest.uploadUrl, {
      method: "POST",
      body: formData,
    });

    if (!storageResponse.ok) {
      throw new Error(
        `Image storage upload failed with status ${storageResponse.status}.`,
      );
    }
  } else if (uploadRequest.providerMode !== "mock") {
    throw new Error("The configured upload provider is not supported.");
  }

  const commitResponse = await fetch(`${API_BASE_URL}/uploads/commit`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      cardDraftId,
      s3Key: uploadRequest.storageKey,
      attestationAccepted: true,
    }),
  });

  if (!commitResponse.ok) {
    const message = await readErrorMessage(
      commitResponse,
      `Upload commit failed with status ${commitResponse.status}.`,
    );
    throw new Error(message);
  }

  return (await commitResponse.json()) as MockUploadResponse;
}

export async function refreshCardDraftBackendState(cardDraftId: string) {
  const [cardDrafts, assets] = await Promise.all([
    fetchUserCardDrafts(),
    fetchCardDraftAssets(cardDraftId),
  ]);

  if (typeof window !== "undefined") {
    const userId = getStoredLocalUser()?.id ?? null;
    window.dispatchEvent(
      new CustomEvent(CARD_DRAFTS_UPDATED_EVENT, {
        detail: { userId, cardDraftId, cardDrafts, assets },
      }),
    );
  }

  return { cardDrafts, assets };
}

export async function startGeneration({
  cardDraftId,
  idempotencyKey,
  assetTypes,
}: StartGenerationRequest): Promise<GenerationStartResponse> {
  const response = await fetch(`${API_BASE_URL}/generation/start`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      cardDraftId,
      idempotencyKey,
      ...(assetTypes?.length ? { assetTypes } : {}),
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Generation request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as GenerationStartResponse;
  const jobId = payload.generationJob?.id;
  const status = payload.generationJob?.overall_status;
  if (jobId && (status === "pending" || status === "running")) {
    return waitForGeneration(jobId);
  }
  assertGenerationSucceeded(payload);
  return payload;
}

export async function fetchGeneration(
  generationJobId: string,
): Promise<GenerationStartResponse> {
  const response = await fetch(
    `${API_BASE_URL}/generation/${encodeURIComponent(generationJobId)}`,
    {
      headers: await buildApiHeaders(),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Generation status request failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  return (await response.json()) as GenerationStartResponse;
}

async function waitForGeneration(generationJobId: string) {
  for (let attempt = 0; attempt < GENERATION_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) =>
      setTimeout(resolve, GENERATION_POLL_INTERVAL_MS),
    );
    const payload = await fetchGeneration(generationJobId);
    const status = payload.generationJob?.overall_status;
    if (status !== "pending" && status !== "running") {
      assertGenerationSucceeded(payload);
      return payload;
    }
  }

  throw new Error(
    "Generation is taking longer than expected. Reopen this draft to check its status.",
  );
}

function assertGenerationSucceeded(payload: GenerationStartResponse) {
  const status = payload.generationJob?.overall_status;
  if (status === "failed" || status === "refunded" || status === "canceled") {
    const providerMessage = payload.generationJob?.error_message;
    throw new Error(
      typeof providerMessage === "string" && providerMessage.trim()
        ? providerMessage
        : "Generation did not complete. Eligible credits were refunded.",
    );
  }
}

export async function createOrder({
  cardDraftId,
  selectedAssetId,
  offerCode,
  quantity,
  recipientAddress,
  recipientAddresses,
  senderAddress,
}: CreateOrderRequest): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      cardDraftId,
      selectedAssetId,
      ...(offerCode ? { offerCode } : {}),
      ...(quantity ? { quantity } : {}),
      recipientAddress,
      ...(recipientAddresses?.length ? { recipientAddresses } : {}),
      senderAddress,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Order creation failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<OrderResponse>;
  if (!payload.order?.id) {
    throw new Error("Order response did not include an order id.");
  }

  return payload.order;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: await buildApiHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Order lookup failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<OrderResponse>;
  if (!payload.order?.id) {
    throw new Error("Order response did not include an order id.");
  }
  return payload.order;
}

export async function fetchUserOrders(): Promise<Order[]> {
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "GET",
    headers: await buildApiHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Order list failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<OrdersResponse>;
  if (
    !Array.isArray(payload.orders) ||
    payload.orders.some((order) => !order?.id)
  ) {
    throw new Error("Order list response was incomplete.");
  }

  return payload.orders;
}

export async function startCheckout(
  orderId: string,
): Promise<CheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/checkout/start`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Checkout start failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CheckoutResponse>;
  if (!payload.checkoutSession?.id || !payload.order?.id) {
    throw new Error(
      "Checkout response did not include a checkout session and order.",
    );
  }

  return {
    checkoutSession: payload.checkoutSession,
    order: payload.order,
    idempotentReplay: payload.idempotentReplay,
  };
}

export async function completeMockCheckout(
  orderId: string,
): Promise<CheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/checkout/mock-success`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Mock checkout completion failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CheckoutResponse>;
  if (!payload.checkoutSession?.id || !payload.order?.id) {
    throw new Error(
      "Mock checkout response did not include a checkout session and order.",
    );
  }

  return {
    checkoutSession: payload.checkoutSession,
    order: payload.order,
    idempotentReplay: payload.idempotentReplay,
  };
}

export async function startCreditPackCheckout(
  offerCode: string,
  idempotencyKey: string,
): Promise<CreditPackCheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/checkout/credit-packs/start`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ offerCode, idempotencyKey }),
  });
  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Credit-pack checkout failed with status ${response.status}.`,
    );
    throw new Error(message);
  }
  const payload = (await response.json()) as Partial<CreditPackCheckoutResponse>;
  if (
    !payload.checkoutSession?.id ||
    !payload.purchase?.id ||
    payload.checkoutSession.creditPackPurchaseId !== payload.purchase.id
  ) {
    throw new Error(
      "Credit-pack checkout response did not include a matching purchase and session.",
    );
  }
  return payload as CreditPackCheckoutResponse;
}

export async function completeMockCreditPackCheckout(
  purchaseId: string,
  checkoutSessionId?: string,
): Promise<CreditPackCheckoutResponse> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/credit-packs/mock-success`,
    {
      method: "POST",
      headers: await buildApiHeaders(undefined, true),
      body: JSON.stringify({
        purchaseId,
        ...(checkoutSessionId ? { checkoutSessionId } : {}),
      }),
    },
  );
  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Mock credit-pack completion failed with status ${response.status}.`,
    );
    throw new Error(message);
  }
  const payload = (await response.json()) as Partial<CreditPackCheckoutResponse>;
  if (!payload.purchase?.id || payload.purchase.status !== "paid") {
    throw new Error(
      "Mock credit-pack completion did not return a paid purchase.",
    );
  }
  return payload as CreditPackCheckoutResponse;
}

export async function fetchCreditPackPurchase(
  purchaseId: string,
): Promise<CreditPackPurchaseResponse> {
  const response = await fetch(
    `${API_BASE_URL}/credits/purchases/${encodeURIComponent(purchaseId)}`,
    {
      method: "GET",
      headers: await buildApiHeaders(),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Credit-pack purchase lookup failed with status ${response.status}.`,
    );
    throw new Error(message);
  }
  const payload = (await response.json()) as Partial<CreditPackPurchaseResponse>;
  if (!payload.purchase?.id || !payload.balance) {
    throw new Error("Credit-pack purchase lookup response was incomplete.");
  }
  return payload as CreditPackPurchaseResponse;
}

export async function finalizeCheckoutAuthorization(
  orderId: string,
  action: "send" | "not_send",
): Promise<AuthorizationFinalizationResponse> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/authorization/finalize`,
    {
      method: "POST",
      headers: await buildApiHeaders(undefined, true),
      body: JSON.stringify({ orderId, action }),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Payment authorization finalization failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload =
    (await response.json()) as Partial<AuthorizationFinalizationResponse>;
  if (!payload.order?.id || !payload.payment?.id) {
    throw new Error(
      "Authorization response did not include an order and payment.",
    );
  }
  return payload as AuthorizationFinalizationResponse;
}

export async function submitFulfillment(
  orderId: string,
): Promise<FulfillmentSubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/fulfillment/submit`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Fulfillment submit failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<FulfillmentSubmitResponse>;
  if (!payload.fulfillment?.id || !payload.order?.id) {
    throw new Error(
      "Fulfillment response did not include a fulfillment record and order.",
    );
  }

  return {
    fulfillment: payload.fulfillment,
    order: payload.order,
  };
}

export async function fetchFulfillments(
  orderId: string,
): Promise<FulfillmentRecord[]> {
  const response = await fetch(
    `${API_BASE_URL}/fulfillment/order/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      headers: await buildApiHeaders(),
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Fulfillment lookup failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<FulfillmentListResponse>;
  if (
    payload.orderId !== orderId ||
    !Array.isArray(payload.fulfillments) ||
    payload.fulfillments.some((fulfillment) => !fulfillment?.id)
  ) {
    throw new Error("Fulfillment lookup response was incomplete.");
  }

  return payload.fulfillments;
}

export async function refreshFulfillment(
  orderId: string,
): Promise<FulfillmentSubmitResponse> {
  const response = await fetch(
    `${API_BASE_URL}/fulfillment/order/${encodeURIComponent(orderId)}/refresh`,
    {
      method: "POST",
      headers: await buildApiHeaders(undefined, true),
    },
  );

  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      `Fulfillment refresh failed with status ${response.status}.`,
    );
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<FulfillmentSubmitResponse>;
  if (!payload.fulfillment?.id || !payload.order?.id) {
    throw new Error(
      "Fulfillment refresh did not include a fulfillment record and order.",
    );
  }
  return payload as FulfillmentSubmitResponse;
}

export async function fetchPublicSouvenote(
  token: string,
): Promise<PublicSouvenote> {
  const response = await fetch(
    `${API_BASE_URL}/public/souvenotes/${encodeURIComponent(token)}`,
    { method: "GET", cache: "no-store", referrerPolicy: "no-referrer" },
  );
  if (!response.ok) {
    const message = await readErrorMessage(
      response,
      response.status === 404
        ? "This Souvenote link is unavailable."
        : `Souvenote playback failed with status ${response.status}.`,
    );
    throw new Error(message);
  }
  const payload = (await response.json()) as Partial<PublicSouvenote>;
  if (
    typeof payload.imageUrl !== "string" ||
    typeof payload.songUrl !== "string" ||
    typeof payload.assetUrlExpiresInSeconds !== "number"
  ) {
    throw new Error("The Souvenote playback response is incomplete.");
  }
  return payload as PublicSouvenote;
}

export function createLocalIdempotencyKey(prefix: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
