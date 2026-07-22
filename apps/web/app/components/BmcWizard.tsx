'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  createCardDraft,
  fetchCardDraftAssets,
  fetchCardDraftById,
  mockUpload,
  refreshCardDraftBackendState,
  startGeneration,
  updateCardDraft,
} from '../lib/api';
import type { CardDraftAsset } from '../lib/api';
import { publishCreditBalance } from '../lib/creditBalance';
import {
  rememberGeneratedAssets,
  rememberSelectedAsset,
  resetMockMvpOrderState,
  writeMockMvpFlowState,
} from '../lib/mockMvpFlow';
import type { CreditBalanceStatus } from '../lib/creditBalance';
import { STEPS, BmcNavContext, BmcErrorModal, bmcError } from './BmcShared';
import { BmcPhotoStep, BmcBasicsStep, BmcImageStep, BmcMessageStep, BmcSongStep } from './BmcSteps';
import type { BmcDraftInputPatch } from './BmcSteps';
import { BmcReview } from './BmcReview';
import { CARD_WITH_QR_SONG_CREDITS, MIN_GENERATION_CREDITS } from './createFlowRules';
import { goToPricingAfterPurchase } from './PricingReturn';

export type BmcWizardStep = 'photo' | 'basics' | 'image' | 'message' | 'song' | 'review';

type BmcWizardProps = {
  initialStep?: BmcWizardStep;
  resumeDraftId?: string | null;
  credits?: number;
  creditStatus?: CreditBalanceStatus;
  refreshCredits?: () => Promise<unknown> | unknown;
  requireAuthToContinue?: boolean;
  onAuthRequired?: () => void;
};

type BmcDraftInput = {
  occasion?: string;
  relationship?: string;
  creativeBrief: Record<string, unknown>;
};

type ReferenceImageUpload = {
  filename: string;
  mimeType: string;
  size: number;
};

const CURRENT_CARD_DRAFT_ID_KEY = 'souv_current_card_draft_id';

function mergeDraftInput(current: BmcDraftInput, patch: BmcDraftInputPatch): BmcDraftInput {
  return {
    occasion: patch.occasion ?? current.occasion,
    relationship: patch.relationship ?? current.relationship,
    creativeBrief: {
      ...current.creativeBrief,
      ...(patch.creativeBrief ?? {}),
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(source[key]);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getReferenceImageUploads(input: BmcDraftInput): ReferenceImageUpload[] {
  const photo = nestedRecord(input.creativeBrief, 'photo');
  const referenceImages = photo.referenceImages;
  if (!Array.isArray(referenceImages)) return [];

  return referenceImages.flatMap((item) => {
    const record = asRecord(item);
    const filename = textValue(record.filename) || textValue(record.name);
    const mimeType = textValue(record.mimeType);
    const size = numberValue(record.size);

    if (!filename || !mimeType.includes('/') || size <= 0) return [];
    return [{ filename, mimeType, size }];
  });
}

function referenceUploadSignature(cardDraftId: string, uploads: ReferenceImageUpload[]) {
  return `${cardDraftId}:${JSON.stringify(uploads)}`;
}

function isBmcWizardStep(value: string): value is BmcWizardStep {
  return ['photo', 'basics', 'image', 'message', 'song', 'review'].includes(value);
}

function BmcWizard({
  initialStep = 'photo',
  resumeDraftId = null,
  credits = 0,
  creditStatus = 'idle',
  refreshCredits,
  requireAuthToContinue = false,
  onAuthRequired,
}: BmcWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<BmcWizardStep>(initialStep);
  const [photoCount, setPhotoCount] = React.useState(0);
  const [describe, setDescribe] = React.useState(false);
  const [includeSong, setIncludeSong] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [startingGeneration, setStartingGeneration] = React.useState(false);
  const [uploadingReferences, setUploadingReferences] = React.useState(false);
  const [reviewAssets, setReviewAssets] = React.useState<CardDraftAsset[]>([]);
  const [reviewAssetsStatus, setReviewAssetsStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [reviewAssetsError, setReviewAssetsError] = React.useState<string | null>(null);
  const [draftInput, setDraftInput] = React.useState<BmcDraftInput>({ creativeBrief: {} });
  const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(null);
  const currentDraftIdRef = React.useRef<string | null>(null);
  const draftSavePromiseRef = React.useRef<Promise<string> | null>(null);
  const lastPersistedDraftRef = React.useRef<string>('');
  const uploadedReferenceSignatureRef = React.useRef<string>('');

  const hasPhoto = photoCount > 0 && !describe;
  const idx = STEPS.findIndex((candidate) => candidate.id === step);
  const stepInstanceKey = `${currentDraftId || 'new'}-${step}`;

  React.useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const goTo = React.useCallback((id: BmcWizardStep) => {
    setGenerating(false);
    setStep(id);
    window.location.hash = id;
  }, []);

  const applyReviewAssets = React.useCallback((cardDraftId: string, assets: CardDraftAsset[]) => {
    setReviewAssets(assets);
    setReviewAssetsStatus('ready');
    setReviewAssetsError(null);
    rememberGeneratedAssets(cardDraftId, assets);
  }, []);

  const refreshReviewAssets = React.useCallback(
    async (cardDraftId: string) => {
      setReviewAssetsStatus('loading');
      setReviewAssetsError(null);

      try {
        const assets = await fetchCardDraftAssets(cardDraftId);
        applyReviewAssets(cardDraftId, assets);
        return assets;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generated assets could not be loaded.';
        setReviewAssets([]);
        setReviewAssetsStatus('error');
        setReviewAssetsError(message);
        throw error;
      }
    },
    [applyReviewAssets],
  );

  const uploadReferenceImages = React.useCallback(
    async (cardDraftId: string, input: BmcDraftInput = draftInput) => {
      const uploads = getReferenceImageUploads(input);
      if (!uploads.length) return;

      const signature = referenceUploadSignature(cardDraftId, uploads);
      if (uploadedReferenceSignatureRef.current === signature) return;

      setUploadingReferences(true);
      try {
        await Promise.all(
          uploads.map((upload) =>
            mockUpload({
              cardDraftId,
              filename: upload.filename,
              mimeType: upload.mimeType,
              size: upload.size,
            }),
          ),
        );
        uploadedReferenceSignatureRef.current = signature;
        await refreshCardDraftBackendState(cardDraftId);
      } finally {
        setUploadingReferences(false);
      }
    },
    [draftInput],
  );

  const goNext = async () => {
    const nextStep = STEPS[idx + 1]?.id;
    if (idx >= 0 && idx < STEPS.length - 1 && isBmcWizardStep(nextStep)) {
      if (requireAuthToContinue && step === 'photo') {
        onAuthRequired?.();
        return;
      }
      if (step === 'photo') {
        try {
          const cardDraftId = await ensureDraftSaved();
          await uploadReferenceImages(cardDraftId);
        } catch (error) {
          bmcError(
            error instanceof Error
              ? error.message
              : 'Your upload could not be saved. Start the local backend and try again.',
            'Upload could not be saved',
          );
          return;
        }
      } else {
        saveDraftInBackground();
      }
      goTo(nextStep);
    }
  };

  const goBack = () => {
    const previousStep = STEPS[idx - 1]?.id;
    if (idx > 0 && isBmcWizardStep(previousStep)) goTo(previousStep);
  };

  const openPricingForCredits = () => {
    router.push(goToPricingAfterPurchase('/create/build-my-card'));
  };

  const rememberDraftId = React.useCallback((draftId: string | null) => {
    currentDraftIdRef.current = draftId;
    setCurrentDraftId(draftId);

    try {
      if (draftId) {
        window.localStorage.setItem(CURRENT_CARD_DRAFT_ID_KEY, draftId);
        writeMockMvpFlowState({ cardDraftId: draftId });
      } else {
        window.localStorage.removeItem(CURRENT_CARD_DRAFT_ID_KEY);
        resetMockMvpOrderState(null);
      }
    } catch {
      // Local draft id persistence is best-effort until auth-backed state exists.
    }
  }, []);

  const persistDraftInput = React.useCallback((draftId: string, nextDraftInput: BmcDraftInput) => {
    const signature = JSON.stringify(nextDraftInput);
    if (signature === lastPersistedDraftRef.current) return;
    lastPersistedDraftRef.current = signature;

    updateCardDraft(draftId, {
      occasion: nextDraftInput.occasion,
      relationship: nextDraftInput.relationship,
      creativeBrief: nextDraftInput.creativeBrief,
    }).catch(() => {
      lastPersistedDraftRef.current = '';
    });
  }, []);

  const updateDraftInput = React.useCallback(
    (patch: BmcDraftInputPatch) => {
      setDraftInput((current) => {
        const next = mergeDraftInput(current, patch);
        if (currentDraftIdRef.current) persistDraftInput(currentDraftIdRef.current, next);
        return next;
      });
    },
    [persistDraftInput],
  );

  const ensureDraftSaved = React.useCallback(
    async (nextIncludeSong = includeSong) => {
      if (currentDraftIdRef.current) {
        const updatedDraftInput = {
          ...draftInput,
          creativeBrief: {
            ...draftInput.creativeBrief,
            includeSong: nextIncludeSong,
          },
        };
        await updateCardDraft(currentDraftIdRef.current, {
          occasion: updatedDraftInput.occasion,
          relationship: updatedDraftInput.relationship,
          creativeBrief: updatedDraftInput.creativeBrief,
        });
        lastPersistedDraftRef.current = JSON.stringify(updatedDraftInput);
        return currentDraftIdRef.current;
      }
      if (draftSavePromiseRef.current) return draftSavePromiseRef.current;

      const savePromise = createCardDraft({
        occasion: draftInput.occasion,
        relationship: draftInput.relationship,
        creativeBrief: {
          flow: 'build_my_card',
          includeSong: nextIncludeSong,
          ...draftInput.creativeBrief,
        },
      })
        .then(async (cardDraft) => {
          rememberDraftId(cardDraft.id);
          resetMockMvpOrderState(cardDraft.id);
          await refreshCardDraftBackendState(cardDraft.id);
          return cardDraft.id;
        })
        .finally(() => {
          draftSavePromiseRef.current = null;
        });

      draftSavePromiseRef.current = savePromise;
      return savePromise;
    },
    [draftInput, includeSong, rememberDraftId],
  );

  React.useEffect(() => {
    if (step !== 'review' || !currentDraftId) return;

    refreshReviewAssets(currentDraftId).catch(() => {
      // The review screen shows the friendly error state.
    });
  }, [currentDraftId, refreshReviewAssets, step]);

  React.useEffect(() => {
    if (!resumeDraftId) return;

    let cancelled = false;
    fetchCardDraftById(resumeDraftId)
      .then((draft) => {
        if (cancelled) return;

        const brief = asRecord(draft.creative_brief);
        rememberDraftId(draft.id);
        setDraftInput({
          occasion: textValue(draft.occasion) || textValue(nestedRecord(brief, 'basics').occasion) || undefined,
          relationship:
            textValue(draft.relationship) || textValue(nestedRecord(brief, 'basics').relationship) || undefined,
          creativeBrief: brief,
        });
        lastPersistedDraftRef.current = JSON.stringify({
          occasion: textValue(draft.occasion) || undefined,
          relationship: textValue(draft.relationship) || undefined,
          creativeBrief: brief,
        });

        const photo = nestedRecord(brief, 'photo');
        const song = nestedRecord(brief, 'song');
        setDescribe(textValue(photo.mode) === 'description');
        setPhotoCount(numberValue(photo.referenceImageCount));
        setIncludeSong(booleanValue(brief.includeSong, booleanValue(song.includeSong, true)));
      })
      .catch((error) => {
        if (!cancelled) {
          bmcError(
            error instanceof Error ? error.message : 'That draft could not be loaded. Please try again.',
            'Draft could not be loaded',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rememberDraftId, resumeDraftId]);

  const saveDraftInBackground = React.useCallback(() => {
    ensureDraftSaved().catch(() => {
      // The generate step will surface backend save errors if the user continues.
    });
  }, [ensureDraftSaved]);

  const onGenerate = async () => {
    if (startingGeneration) return;
    const generationCost = includeSong ? CARD_WITH_QR_SONG_CREDITS : MIN_GENERATION_CREDITS;

    if (creditStatus === 'loading') {
      bmcError('We are still checking your credit balance. Try again in a moment.', 'Checking credits');
      return;
    }

    if (creditStatus === 'error') {
      bmcError(
        'We could not reach your backend credit balance. Start the local backend and try again.',
        'Credits unavailable',
      );
      await refreshCredits?.();
      return;
    }

    if (credits < generationCost) {
      bmcError(
        `You need ${generationCost} ${generationCost === 1 ? 'credit' : 'credits'} to generate this card. Your current backend balance is ${credits}.`,
        'Not enough credits',
      );
      return;
    }

    setGenerating(true);
    setStartingGeneration(true);

    try {
      const cardDraftId = await ensureDraftSaved(includeSong);
      await uploadReferenceImages(cardDraftId);

      const response = await startGeneration({
        cardDraftId,
        idempotencyKey: `frontend-generation-${Date.now()}`,
      });
      const backendState = await refreshCardDraftBackendState(cardDraftId);
      applyReviewAssets(cardDraftId, backendState.assets);

      if (response.balance) {
        publishCreditBalance(response.balance);
      } else {
        await refreshCredits?.();
      }

      setStep('review');
      window.location.hash = 'review';
      window.setTimeout(() => setGenerating(false), 5200);
    } catch (error) {
      setGenerating(false);
      bmcError(
        error instanceof Error ? error.message : 'Generation could not start. Please try again.',
        'Generation could not start',
      );
      await refreshCredits?.();
    } finally {
      setStartingGeneration(false);
    }
  };

  const spendRegenerationCredit = async () => {
    bmcError(
      'One-credit image and song regeneration is coming in the approved creation-workflow section. No credit was charged.',
      'Regeneration coming soon',
    );
    return false;
  };

  const startOver = () => {
    setPhotoCount(0);
    setDescribe(false);
    setGenerating(false);
    setDraftInput({ creativeBrief: {} });
    setReviewAssets([]);
    setReviewAssetsStatus('idle');
    setReviewAssetsError(null);
    uploadedReferenceSignatureRef.current = '';
    rememberDraftId(null);
    setStep('photo');
    window.location.hash = 'photo';
  };

  React.useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('#bmc-step-toggle a[data-step]').forEach((anchor) => {
      anchor.classList.toggle('is-active', anchor.dataset.step === step && !generating);
    });

    const credEl = document.getElementById('bmc-cred-readout');
    if (credEl) credEl.textContent = credits + (credits === 1 ? ' credit' : ' credits');
  }, [step, generating, credits, refreshCredits]);

  const isReview = step === 'review';

  return (
    <>
      {isReview ? (
        <BmcReview
          generating={generating}
          includeSong={includeSong}
          credits={credits}
          cardDraftId={currentDraftId}
          assets={reviewAssets}
          assetsStatus={reviewAssetsStatus}
          assetsError={reviewAssetsError}
          onStartOver={startOver}
          onTopUp={openPricingForCredits}
          onRegenerateAsset={spendRegenerationCredit}
          onApproveAll={(selectedAssetId) => {
            if (!currentDraftId || !selectedAssetId) {
              bmcError(
                'Generated image assets are not ready yet. Try again after the review assets finish loading.',
                'Review assets unavailable',
              );
              return;
            }

            rememberSelectedAsset(currentDraftId, selectedAssetId, reviewAssets);
            router.push('/delivery');
          }}
        />
      ) : (
        <div className="bmc-shell">
          <div className="bmc-headcard" aria-hidden="true">
            <div className="bmc-headcard-spin">
              <div className="bmc-headcard-face bmc-headcard-front">
                <img src="/assets/hero-souvenote-card-face.png" alt="" />
              </div>
              <div className="bmc-headcard-face bmc-headcard-back">
                <img src="/assets/bmc-fathers-day-card.jpg" alt="" />
              </div>
            </div>
          </div>
          <BmcNavContext.Provider value={{ activeId: step, onChange: goTo }}>
            <>
              {step === 'photo' && (
                <BmcPhotoStep
                  key={stepInstanceKey}
                  photoCount={photoCount}
                  setPhotoCount={setPhotoCount}
                  describe={describe}
                  setDescribe={setDescribe}
                  onContinue={goNext}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                  uploading={uploadingReferences}
                />
              )}
              {step === 'basics' && (
                <BmcBasicsStep
                  key={stepInstanceKey}
                  onContinue={goNext}
                  onBack={goBack}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                />
              )}
              {step === 'image' && (
                <BmcImageStep
                  key={stepInstanceKey}
                  onContinue={goNext}
                  onBack={goBack}
                  hasPhoto={hasPhoto}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                />
              )}
              {step === 'message' && (
                <BmcMessageStep
                  key={stepInstanceKey}
                  onContinue={goNext}
                  onBack={goBack}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                />
              )}
              {step === 'song' && (
                <BmcSongStep
                  key={stepInstanceKey}
                  includeSong={includeSong}
                  setIncludeSong={setIncludeSong}
                  onBack={goBack}
                  onGenerate={onGenerate}
                  generating={startingGeneration}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                />
              )}
            </>
          </BmcNavContext.Provider>
        </div>
      )}

      <BmcErrorModal />
    </>
  );
}

export { BmcWizard };
