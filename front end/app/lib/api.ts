import { getActiveCognitoSession, getStoredLocalUser } from "./cognitoAuth";
import type { LocalUser } from "./cognitoAuth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

export const LOCAL_MOCK_USER_ID = "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef";

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
  userId?: string;
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
  moderationState?: string | null;
  approvedAt?: string | null;
  printAssetKey?: string | null;
  qrMetadata?: Record<string, unknown>;
  createdAt?: string | null;
};

export type MockUploadRequest = {
  userId?: string;
  cardDraftId: string;
  filename: string;
  mimeType: string;
  size: number;
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

type CardDraftAssetsResponse = {
  cardDraftId: string;
  assets: CardDraftAsset[];
};

export type StartGenerationRequest = {
  userId?: string;
  cardDraftId?: string;
  idempotencyKey: string;
};

export type GenerationStartResponse = {
  generationJob?: {
    id?: string;
    credits_charged?: number;
    [key: string]: unknown;
  };
  savedAssets?: CardDraftAsset[];
  mockAssets?: Record<string, unknown>;
  creditDeduction?: Record<string, unknown>;
  balance?: CreditBalance;
};

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
  userId?: string;
  cardDraftId: string;
  selectedAssetId: string;
  recipientAddress: PostalAddress;
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
  checkoutSessionId?: string | null;
  paymentId?: string | null;
  fulfillmentJobId?: string | null;
  mockFulfillmentId?: string | null;
  trackingUrl?: string | null;
  recipientAddress?: Record<string, unknown>;
  senderAddress?: Record<string, unknown>;
  qrCodeUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type OrderResponse = {
  order: Order;
};

export type CheckoutSession = {
  id: string;
  orderId: string;
  paymentId: string;
  providerMode?: string;
  status: string;
  amountCents?: number;
  currency?: string;
  checkoutUrl?: string;
  successUrl?: string | null;
  cancelUrl?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
};

export type CheckoutResponse = {
  checkoutSession: CheckoutSession;
  order: Order;
};

export type FulfillmentRecord = {
  id: string;
  orderId: string;
  userId: string;
  providerMode?: string;
  mockFulfillmentId?: string;
  status: string;
  submittedAt?: string | null;
  estimatedDelivery?: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type FulfillmentSubmitResponse = {
  fulfillment: FulfillmentRecord;
  order: Order;
};

export type GrantCreditsRequest = {
  userId?: string;
  amount: number;
  source: string;
  idempotencyKey: string;
};

export type GrantCreditsResponse = {
  ledgerEntry?: Record<string, unknown>;
  balance?: CreditBalance;
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

export function getApiUserId(userId?: string) {
  return userId || getStoredLocalUser()?.id || LOCAL_MOCK_USER_ID;
}

async function buildApiHeaders(headers?: HeadersInit, json = false) {
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has("Accept")) nextHeaders.set("Accept", "application/json");
  if (json && !nextHeaders.has("Content-Type")) nextHeaders.set("Content-Type", "application/json");

  const session = await getActiveCognitoSession();
  if (session?.idToken) {
    nextHeaders.set("Authorization", `Bearer ${session.idToken}`);
  }

  return nextHeaders;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (Array.isArray(payload.message) && typeof payload.message[0] === "string") return payload.message[0];
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep the original fallback when the server does not return JSON.
  }

  return fallback;
}

export async function fetchPricingOffers(): Promise<PricingOffer[]> {
  const response = await fetch(`${API_BASE_URL}/pricing`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Pricing request failed with status ${response.status}.`);
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
    const message = await readErrorMessage(response, `Authenticated user request failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<AuthMeResponse>;
  if (typeof payload.user?.id !== "string" || typeof payload.user.email !== "string") {
    throw new Error("Authenticated user response did not include a local user id.");
  }

  return payload.user;
}

export async function updateAuthenticatedUser(input: UserProfileUpdate): Promise<LocalUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PATCH",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Profile update failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<AuthMeResponse>;
  if (typeof payload.user?.id !== "string" || typeof payload.user.email !== "string") {
    throw new Error("Profile update response did not include a local user.");
  }

  return payload.user;
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Payment methods request failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodsResponse>;
  if (!Array.isArray(payload.paymentMethods)) {
    throw new Error("Payment methods response did not include a paymentMethods array.");
  }

  return payload.paymentMethods;
}

export async function createPaymentMethod(input: SavePaymentMethodRequest): Promise<PaymentMethod> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Payment method save failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodResponse>;
  if (!payload.paymentMethod?.id) {
    throw new Error("Payment method response did not include a saved method.");
  }

  return payload.paymentMethod;
}

export async function updatePaymentMethod(paymentMethodId: string, input: SavePaymentMethodRequest): Promise<PaymentMethod> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
    method: "PATCH",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Payment method update failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<PaymentMethodResponse>;
  if (!payload.paymentMethod?.id) {
    throw new Error("Payment method response did not include an updated method.");
  }

  return payload.paymentMethod;
}

export async function deletePaymentMethod(paymentMethodId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
    method: "DELETE",
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Payment method delete failed with status ${response.status}.`);
    throw new Error(message);
  }
}

export async function fetchCreditBalance(userId?: string): Promise<CreditBalance> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/credits/balance/${encodeURIComponent(resolvedUserId)}`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Credit balance request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<CreditBalance>;

  if (typeof payload.userId !== "string" || typeof payload.balance !== "number" || !Number.isFinite(payload.balance)) {
    throw new Error("Credit balance response did not include a valid balance.");
  }

  return {
    userId: payload.userId,
    balance: payload.balance,
  };
}

export async function createCardDraft({
  userId,
  occasion,
  relationship,
  creativeBrief,
}: CreateCardDraftRequest): Promise<CardDraft> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/card-drafts`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      userId: resolvedUserId,
      ...(occasion ? { occasion } : {}),
      ...(relationship ? { relationship } : {}),
      creativeBrief: creativeBrief ?? {},
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Card draft request failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftResponse>;
  if (!payload.cardDraft?.id) {
    throw new Error("Card draft response did not include a draft id.");
  }

  return payload.cardDraft;
}

export async function fetchCardDraftById(cardDraftId: string): Promise<CardDraft> {
  const response = await fetch(`${API_BASE_URL}/card-drafts/${encodeURIComponent(cardDraftId)}`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Card draft request failed with status ${response.status}.`);
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
  const response = await fetch(`${API_BASE_URL}/card-drafts/${encodeURIComponent(cardDraftId)}`, {
    method: "PATCH",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      ...(occasion ? { occasion } : {}),
      ...(relationship ? { relationship } : {}),
      ...(creativeBrief ? { creativeBrief } : {}),
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Card draft update failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftResponse>;
  if (!payload.cardDraft?.id) {
    throw new Error("Card draft update response did not include a draft id.");
  }

  return payload.cardDraft;
}

export async function fetchUserCardDrafts(userId?: string): Promise<CardDraft[]> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/card-drafts/user/${encodeURIComponent(resolvedUserId)}`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Card drafts request failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<UserCardDraftsResponse>;
  if (!Array.isArray(payload.cardDrafts)) {
    throw new Error("Card drafts response did not include a cardDrafts array.");
  }

  return payload.cardDrafts;
}

export async function fetchCardDraftAssets(cardDraftId: string): Promise<CardDraftAsset[]> {
  const response = await fetch(`${API_BASE_URL}/assets/card-draft/${encodeURIComponent(cardDraftId)}`, {
    headers: await buildApiHeaders(),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Card draft assets request failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CardDraftAssetsResponse>;
  if (!Array.isArray(payload.assets)) {
    throw new Error("Card draft assets response did not include an assets array.");
  }

  return payload.assets;
}

export async function mockUpload({
  userId,
  cardDraftId,
  filename,
  mimeType,
  size,
}: MockUploadRequest): Promise<MockUploadResponse> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/uploads/mock`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      userId: resolvedUserId,
      cardDraftId,
      filename,
      mimeType,
      size,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Mock upload failed with status ${response.status}.`);
    throw new Error(message);
  }

  return (await response.json()) as MockUploadResponse;
}

export async function refreshCardDraftBackendState(cardDraftId: string, userId?: string) {
  const resolvedUserId = getApiUserId(userId);
  const [cardDrafts, assets] = await Promise.all([
    fetchUserCardDrafts(resolvedUserId),
    fetchCardDraftAssets(cardDraftId),
  ]);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CARD_DRAFTS_UPDATED_EVENT, {
      detail: { userId: resolvedUserId, cardDraftId, cardDrafts, assets },
    }));
  }

  return { cardDrafts, assets };
}

export async function startGeneration({
  userId,
  cardDraftId,
  idempotencyKey,
}: StartGenerationRequest): Promise<GenerationStartResponse> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/generation/start`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      userId: resolvedUserId,
      ...(cardDraftId ? { cardDraftId } : {}),
      idempotencyKey,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Generation request failed with status ${response.status}.`);
    throw new Error(message);
  }

  return (await response.json()) as GenerationStartResponse;
}

export async function createOrder({
  userId,
  cardDraftId,
  selectedAssetId,
  recipientAddress,
  senderAddress,
}: CreateOrderRequest): Promise<Order> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      userId: resolvedUserId,
      cardDraftId,
      selectedAssetId,
      recipientAddress,
      senderAddress,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Order creation failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<OrderResponse>;
  if (!payload.order?.id) {
    throw new Error("Order response did not include an order id.");
  }

  return payload.order;
}

export async function startCheckout(orderId: string): Promise<CheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/checkout/start`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Checkout start failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CheckoutResponse>;
  if (!payload.checkoutSession?.id || !payload.order?.id) {
    throw new Error("Checkout response did not include a checkout session and order.");
  }

  return {
    checkoutSession: payload.checkoutSession,
    order: payload.order,
  };
}

export async function completeMockCheckout(orderId: string): Promise<CheckoutResponse> {
  const response = await fetch(`${API_BASE_URL}/checkout/mock-success`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Mock checkout completion failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<CheckoutResponse>;
  if (!payload.checkoutSession?.id || !payload.order?.id) {
    throw new Error("Mock checkout response did not include a checkout session and order.");
  }

  return {
    checkoutSession: payload.checkoutSession,
    order: payload.order,
  };
}

export async function submitFulfillment(orderId: string): Promise<FulfillmentSubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/fulfillment/submit`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Fulfillment submit failed with status ${response.status}.`);
    throw new Error(message);
  }

  const payload = (await response.json()) as Partial<FulfillmentSubmitResponse>;
  if (!payload.fulfillment?.id || !payload.order?.id) {
    throw new Error("Fulfillment response did not include a fulfillment record and order.");
  }

  return {
    fulfillment: payload.fulfillment,
    order: payload.order,
  };
}

export async function grantCredits({
  userId,
  amount,
  source,
  idempotencyKey,
}: GrantCreditsRequest): Promise<GrantCreditsResponse> {
  const resolvedUserId = getApiUserId(userId);
  const response = await fetch(`${API_BASE_URL}/credits/grant`, {
    method: "POST",
    headers: await buildApiHeaders(undefined, true),
    body: JSON.stringify({
      userId: resolvedUserId,
      amount,
      source,
      idempotencyKey,
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response, `Credit grant request failed with status ${response.status}.`);
    throw new Error(message);
  }

  return (await response.json()) as GrantCreditsResponse;
}

export function createLocalIdempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
