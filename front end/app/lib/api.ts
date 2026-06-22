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
