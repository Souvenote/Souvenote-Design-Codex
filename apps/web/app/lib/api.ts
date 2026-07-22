import { createSouvenoteApiClient, type ApiError, type components } from '@souvenote/contracts';
import { AUTH_CSRF_HEADER } from './auth/constants';
import { fetchBffSession } from './cognitoAuth';
import type { LocalUser } from './cognitoAuth';

type Schemas = components['schemas'];
const api = createSouvenoteApiClient();

export type PricingOffer = {
  id: string;
  offerId: string;
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

export type CreditBalance = Schemas['CreditBalanceResponseDto'];

export type CardDraft = Schemas['CardDraftViewDto'] & {
  user_id?: string;
  creative_brief?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateCardDraftRequest = Omit<Schemas['CreateCardDraftDto'], 'creationRoute'> & {
  creationRoute?: Schemas['CreateCardDraftDto']['creationRoute'];
};
export type UpdateCardDraftRequest = Schemas['UpdateCardDraftDto'];

export type CardDraftAsset = Schemas['AssetViewDto'] & {
  asset_type?: string;
};

export type MockUploadRequest = Omit<Schemas['RequestUploadDto'], 'contentSha256' | 'mimeType'> & { mimeType: string };
export type MockUploadResponse = Schemas['UploadResponseDto'];

export type StartGenerationRequest = { cardDraftId?: string; idempotencyKey: string };
export type GenerationStartResponse = Omit<Schemas['GenerationStartResponseDto'], 'balance'> & {
  balance: CreditBalance;
};
export type UserProfileUpdate = Schemas['UpdateProfileDto'];

export const CARD_DRAFTS_UPDATED_EVENT = 'souv-card-drafts-updated';

function errorFrom(result: { error?: unknown; response: Response }, fallback: string): Error {
  const candidate = result.error as Partial<ApiError> | undefined;
  return new Error(typeof candidate?.message === 'string' ? candidate.message : fallback);
}

async function mutationHeaders(idempotencyKey?: string) {
  const session = await fetchBffSession();
  if (!session.authenticated || !session.csrfToken) throw new Error('Authentication is required.');
  return {
    [AUTH_CSRF_HEADER]: session.csrfToken,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

function cardDraftFromApi(value: unknown): CardDraft {
  const draft = value as CardDraft;
  return {
    ...draft,
    user_id: undefined,
    creative_brief: draft.creativeBrief,
    created_at: draft.createdAt,
    updated_at: draft.updatedAt,
  };
}

export async function fetchPricingOffers(): Promise<PricingOffer[]> {
  const result = await api.GET('/api/v1/pricing');
  if (result.error) throw errorFrom(result, `Pricing request failed with status ${result.response.status}.`);
  const rows = result.data?.data ?? [];
  return rows.map((offer) => ({
    id: offer.id,
    offerId: offer.offerId,
    name: offer.id,
    type: offer.type,
    priceCents: offer.unitAmountMinor,
    currency: offer.currency,
    cardCountMin: offer.minimumQuantity,
    cardCountMax: offer.maximumQuantity,
    creditsPerCard: offer.creditsPerCard,
    shippingIncluded: offer.shippingIncluded,
    metadata: offer.metadata,
  }));
}

export async function fetchAuthenticatedUser(): Promise<LocalUser> {
  const session = await fetchBffSession();
  if (!session.authenticated || !session.user) throw new Error('Authentication is required.');
  return session.user;
}

export async function updateAuthenticatedUser(input: UserProfileUpdate): Promise<LocalUser> {
  const result = await api.PATCH('/api/v1/me', { body: input, headers: await mutationHeaders() });
  if (result.error) throw errorFrom(result, `Profile update failed with status ${result.response.status}.`);
  const user = (result.data as { user?: LocalUser } | undefined)?.user;
  if (!user) throw new Error('Profile update returned no user.');
  return user;
}

export async function fetchCreditBalance(): Promise<CreditBalance> {
  const result = await api.GET('/api/v1/credits');
  if (result.error) throw errorFrom(result, `Credit balance request failed with status ${result.response.status}.`);
  const balance = Number(result.data?.balance);
  if (!Number.isFinite(balance)) throw new Error('Credit balance response was invalid.');
  return { balance };
}

export async function createCardDraft(input: CreateCardDraftRequest): Promise<CardDraft> {
  const body: Schemas['CreateCardDraftDto'] = {
    ...input,
    creationRoute: input.creationRoute ?? 'build_my_card',
  };
  const result = await api.POST('/api/v1/card-drafts', { body, headers: await mutationHeaders() });
  if (result.error) throw errorFrom(result, `Card draft request failed with status ${result.response.status}.`);
  const draft = result.data?.cardDraft;
  if (!draft) throw new Error('Card draft response did not include a draft.');
  return cardDraftFromApi(draft);
}

export async function fetchCardDraftById(cardDraftId: string): Promise<CardDraft> {
  const result = await api.GET('/api/v1/card-drafts/{draftId}', { params: { path: { draftId: cardDraftId } } });
  if (result.error) throw errorFrom(result, `Card draft request failed with status ${result.response.status}.`);
  const draft = result.data?.cardDraft;
  if (!draft) throw new Error('Card draft response did not include a draft.');
  return cardDraftFromApi(draft);
}

export async function updateCardDraft(cardDraftId: string, input: UpdateCardDraftRequest): Promise<CardDraft> {
  const result = await api.PATCH('/api/v1/card-drafts/{draftId}', {
    params: { path: { draftId: cardDraftId } },
    body: input,
    headers: await mutationHeaders(),
  });
  if (result.error) throw errorFrom(result, `Card draft update failed with status ${result.response.status}.`);
  const draft = result.data?.cardDraft;
  if (!draft) throw new Error('Card draft update returned no draft.');
  return cardDraftFromApi(draft);
}

export async function fetchUserCardDrafts(): Promise<CardDraft[]> {
  const result = await api.GET('/api/v1/card-drafts', { params: { query: { limit: 100 } } });
  if (result.error) throw errorFrom(result, `Card drafts request failed with status ${result.response.status}.`);
  const rows = result.data?.data ?? [];
  return rows.map(cardDraftFromApi);
}

export async function fetchCardDraftAssets(cardDraftId: string): Promise<CardDraftAsset[]> {
  const result = await api.GET('/api/v1/assets', { params: { query: { cardDraftId } } });
  if (result.error) throw errorFrom(result, `Assets request failed with status ${result.response.status}.`);
  return result.data?.data ?? [];
}

async function mockContentHash(input: MockUploadRequest) {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function mockUpload(input: MockUploadRequest): Promise<MockUploadResponse> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) {
    throw new Error('Only JPEG, PNG, and WebP reference images are accepted.');
  }
  const requestKey = createLocalIdempotencyKey('upload-request');
  const requested = await api.POST('/api/v1/uploads', {
    params: { header: { 'Idempotency-Key': requestKey } },
    body: {
      ...input,
      mimeType: input.mimeType as Schemas['RequestUploadDto']['mimeType'],
      contentSha256: await mockContentHash(input),
    },
    headers: await mutationHeaders(requestKey),
  });
  if (requested.error) throw errorFrom(requested, `Upload request failed with status ${requested.response.status}.`);
  const upload = requested.data?.upload;
  if (!upload?.id) throw new Error('Upload request returned no upload.');
  const completionKey = createLocalIdempotencyKey('upload-complete');
  const completed = await api.PATCH('/api/v1/uploads/{uploadId}/complete', {
    params: { path: { uploadId: upload.id }, header: { 'Idempotency-Key': completionKey } },
    body: { attestationAccepted: true },
    headers: await mutationHeaders(completionKey),
  });
  if (completed.error) throw errorFrom(completed, `Upload completion failed with status ${completed.response.status}.`);
  if (!completed.data) throw new Error('Upload completion returned no upload.');
  return completed.data;
}

export async function refreshCardDraftBackendState(cardDraftId: string) {
  const [cardDrafts, assets] = await Promise.all([fetchUserCardDrafts(), fetchCardDraftAssets(cardDraftId)]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CARD_DRAFTS_UPDATED_EVENT, { detail: { cardDraftId, cardDrafts, assets } }));
  }
  return { cardDrafts, assets };
}

export async function startGeneration(input: StartGenerationRequest): Promise<GenerationStartResponse> {
  if (!input.cardDraftId) throw new Error('Save the card draft before starting generation.');
  const result = await api.POST('/api/v1/generation-jobs', {
    params: { header: { 'Idempotency-Key': input.idempotencyKey } },
    body: { cardDraftId: input.cardDraftId },
    headers: await mutationHeaders(input.idempotencyKey),
  });
  if (result.error) throw errorFrom(result, `Generation request failed with status ${result.response.status}.`);
  if (!result.data) throw new Error('Generation request returned no job.');
  return { ...result.data, balance: { balance: result.data.balance } };
}

export function createLocalIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
