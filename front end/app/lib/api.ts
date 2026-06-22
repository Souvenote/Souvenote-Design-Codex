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
  savedAssets?: unknown[];
  mockAssets?: Record<string, unknown>;
  creditDeduction?: Record<string, unknown>;
  balance?: CreditBalance;
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

export const CARD_DRAFTS_UPDATED_EVENT = "souv-card-drafts-updated";

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
    headers: {
      Accept: "application/json",
    },
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

export async function fetchCreditBalance(userId = LOCAL_MOCK_USER_ID): Promise<CreditBalance> {
  const response = await fetch(`${API_BASE_URL}/credits/balance/${encodeURIComponent(userId)}`, {
    headers: {
      Accept: "application/json",
    },
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
  userId = LOCAL_MOCK_USER_ID,
  occasion,
  relationship,
  creativeBrief,
}: CreateCardDraftRequest): Promise<CardDraft> {
  const response = await fetch(`${API_BASE_URL}/card-drafts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
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
    headers: {
      Accept: "application/json",
    },
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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
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

export async function fetchUserCardDrafts(userId = LOCAL_MOCK_USER_ID): Promise<CardDraft[]> {
  const response = await fetch(`${API_BASE_URL}/card-drafts/user/${encodeURIComponent(userId)}`, {
    headers: {
      Accept: "application/json",
    },
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
    headers: {
      Accept: "application/json",
    },
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

export async function refreshCardDraftBackendState(cardDraftId: string, userId = LOCAL_MOCK_USER_ID) {
  const [cardDrafts, assets] = await Promise.all([
    fetchUserCardDrafts(userId),
    fetchCardDraftAssets(cardDraftId),
  ]);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CARD_DRAFTS_UPDATED_EVENT, {
      detail: { userId, cardDraftId, cardDrafts, assets },
    }));
  }

  return { cardDrafts, assets };
}

export async function startGeneration({
  userId = LOCAL_MOCK_USER_ID,
  cardDraftId,
  idempotencyKey,
}: StartGenerationRequest): Promise<GenerationStartResponse> {
  const response = await fetch(`${API_BASE_URL}/generation/start`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
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

export async function grantCredits({
  userId = LOCAL_MOCK_USER_ID,
  amount,
  source,
  idempotencyKey,
}: GrantCreditsRequest): Promise<GrantCreditsResponse> {
  const response = await fetch(`${API_BASE_URL}/credits/grant`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
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
