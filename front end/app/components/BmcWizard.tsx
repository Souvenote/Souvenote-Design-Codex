"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createCardDraft, createLocalIdempotencyKey, fetchCardDraftById, refreshCardDraftBackendState, startGeneration, updateCardDraft } from "../lib/api";
import { publishCreditBalance } from "../lib/creditBalance";
import type { CreditBalanceStatus } from "../lib/creditBalance";
import { STEPS, BmcNavContext, BmcErrorModal, bmcError } from "./BmcShared";
import { BmcPhotoStep, BmcBasicsStep, BmcImageStep, BmcMessageStep, BmcSongStep } from "./BmcSteps";
import type { BmcDraftInputPatch } from "./BmcSteps";
import { BmcReview } from "./BmcReview";
import { CARD_WITH_QR_SONG_CREDITS, MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

export type BmcWizardStep = "photo" | "basics" | "image" | "message" | "song" | "review";

type BmcWizardProps = {
  initialStep?: BmcWizardStep;
  resumeDraftId?: string | null;
  credits?: number;
  creditStatus?: CreditBalanceStatus;
  refreshCredits?: () => Promise<unknown> | unknown;
};

type BmcDraftInput = {
  occasion?: string;
  relationship?: string;
  creativeBrief: Record<string, unknown>;
};

const CURRENT_CARD_DRAFT_ID_KEY = "souv_current_card_draft_id";

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
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(source[key]);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

declare global {
  interface Window {
    __bmcGoStep?: (id: BmcWizardStep) => void;
    __bmcSetCredits?: (credits: number) => void;
  }
}

function isBmcWizardStep(value: string): value is BmcWizardStep {
  return ["photo", "basics", "image", "message", "song", "review"].includes(value);
}

function BmcWizard({
  initialStep = "photo",
  resumeDraftId = null,
  credits = 0,
  creditStatus = "idle",
  refreshCredits,
}: BmcWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<BmcWizardStep>(initialStep);
  const [photoCount, setPhotoCount] = React.useState(0);
  const [describe, setDescribe] = React.useState(false);
  const [includeSong, setIncludeSong] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [startingGeneration, setStartingGeneration] = React.useState(false);
  const [draftInput, setDraftInput] = React.useState<BmcDraftInput>({ creativeBrief: {} });
  const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(null);
  const currentDraftIdRef = React.useRef<string | null>(null);
  const draftSavePromiseRef = React.useRef<Promise<string> | null>(null);
  const lastPersistedDraftRef = React.useRef<string>("");

  const hasPhoto = photoCount > 0 && !describe;
  const idx = STEPS.findIndex((candidate) => candidate.id === step);
  const stepInstanceKey = `${currentDraftId || "new"}-${step}`;

  React.useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const goTo = React.useCallback((id: BmcWizardStep) => {
    setGenerating(false);
    setStep(id);
    window.location.hash = id;
  }, []);

  const goNext = () => {
    const nextStep = STEPS[idx + 1]?.id;
    if (idx >= 0 && idx < STEPS.length - 1 && isBmcWizardStep(nextStep)) {
      saveDraftInBackground();
      goTo(nextStep);
    }
  };

  const goBack = () => {
    const previousStep = STEPS[idx - 1]?.id;
    if (idx > 0 && isBmcWizardStep(previousStep)) goTo(previousStep);
  };

  const openPricingForCredits = () => {
    router.push(goToPricingAfterPurchase("/create/build-my-card"));
  };

  const rememberDraftId = React.useCallback((draftId: string | null) => {
    currentDraftIdRef.current = draftId;
    setCurrentDraftId(draftId);

    try {
      if (draftId) {
        window.localStorage.setItem(CURRENT_CARD_DRAFT_ID_KEY, draftId);
      } else {
        window.localStorage.removeItem(CURRENT_CARD_DRAFT_ID_KEY);
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
      lastPersistedDraftRef.current = "";
    });
  }, []);

  const updateDraftInput = React.useCallback((patch: BmcDraftInputPatch) => {
    setDraftInput((current) => {
      const next = mergeDraftInput(current, patch);
      if (currentDraftIdRef.current) persistDraftInput(currentDraftIdRef.current, next);
      return next;
    });
  }, [persistDraftInput]);

  const ensureDraftSaved = React.useCallback(async (nextIncludeSong = includeSong) => {
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
        flow: "build_my_card",
        includeSong: nextIncludeSong,
        ...draftInput.creativeBrief,
      },
    })
      .then(async (cardDraft) => {
        rememberDraftId(cardDraft.id);
        await refreshCardDraftBackendState(cardDraft.id);
        return cardDraft.id;
      })
      .finally(() => {
        draftSavePromiseRef.current = null;
      });

    draftSavePromiseRef.current = savePromise;
    return savePromise;
  }, [draftInput, includeSong, rememberDraftId]);

  React.useEffect(() => {
    if (!resumeDraftId) return;

    let cancelled = false;
    fetchCardDraftById(resumeDraftId)
      .then((draft) => {
        if (cancelled) return;

        const brief = asRecord(draft.creative_brief);
        rememberDraftId(draft.id);
        setDraftInput({
          occasion: textValue(draft.occasion) || textValue(nestedRecord(brief, "basics").occasion) || undefined,
          relationship: textValue(draft.relationship) || textValue(nestedRecord(brief, "basics").relationship) || undefined,
          creativeBrief: brief,
        });
        lastPersistedDraftRef.current = JSON.stringify({
          occasion: textValue(draft.occasion) || undefined,
          relationship: textValue(draft.relationship) || undefined,
          creativeBrief: brief,
        });

        const photo = nestedRecord(brief, "photo");
        const song = nestedRecord(brief, "song");
        setDescribe(textValue(photo.mode) === "description");
        setPhotoCount(numberValue(photo.referenceImageCount));
        setIncludeSong(booleanValue(brief.includeSong, booleanValue(song.includeSong, true)));
      })
      .catch((error) => {
        if (!cancelled) {
          bmcError(
            error instanceof Error ? error.message : "That draft could not be loaded. Please try again.",
            "Draft could not be loaded",
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

    if (creditStatus === "loading") {
      bmcError("We are still checking your credit balance. Try again in a moment.", "Checking credits");
      return;
    }

    if (creditStatus === "error") {
      bmcError("We could not reach your backend credit balance. Start the local backend and try again.", "Credits unavailable");
      await refreshCredits?.();
      return;
    }

    if (credits < generationCost) {
      bmcError(
        `You need ${generationCost} ${generationCost === 1 ? "credit" : "credits"} to generate this card. Your current backend balance is ${credits}.`,
        "Not enough credits",
      );
      return;
    }

    setGenerating(true);
    setStartingGeneration(true);

    try {
      const cardDraftId = await ensureDraftSaved(includeSong);

      const response = await startGeneration({
        cardDraftId,
        idempotencyKey: createLocalIdempotencyKey("build-my-card-generation"),
      });
      await refreshCardDraftBackendState(cardDraftId);

      if (response.balance) {
        publishCreditBalance(response.balance);
      } else {
        await refreshCredits?.();
      }

      setStep("review");
      window.location.hash = "review";
      window.setTimeout(() => setGenerating(false), 5200);
    } catch (error) {
      setGenerating(false);
      bmcError(
        error instanceof Error ? error.message : "Generation could not start. Please try again.",
        "Generation could not start",
      );
      await refreshCredits?.();
    } finally {
      setStartingGeneration(false);
    }
  };

  const spendRegenerationCredit = async () => {
    if (credits < MIN_GENERATION_CREDITS) {
      bmcError("You need at least 1 credit to regenerate an asset.", "Not enough credits");
      return false;
    }

    try {
      const response = await startGeneration({
        ...(currentDraftId ? { cardDraftId: currentDraftId } : {}),
        idempotencyKey: createLocalIdempotencyKey("build-my-card-regenerate"),
      });
      if (currentDraftId) {
        await refreshCardDraftBackendState(currentDraftId);
      }

      if (response.balance) {
        publishCreditBalance(response.balance);
      } else {
        await refreshCredits?.();
      }

      return true;
    } catch (error) {
      bmcError(
        error instanceof Error ? error.message : "Regeneration could not start. Please try again.",
        "Regeneration could not start",
      );
      await refreshCredits?.();
      return false;
    }
  };

  const startOver = () => {
    setPhotoCount(0);
    setDescribe(false);
    setGenerating(false);
    setDraftInput({ creativeBrief: {} });
    rememberDraftId(null);
    setStep("photo");
    window.location.hash = "photo";
  };

  React.useEffect(() => {
    window.__bmcGoStep = (id) => {
      if (id === "review") setGenerating(false);
      setStep(id);
    };
    window.__bmcSetCredits = () => {
      void refreshCredits?.();
    };

    document.querySelectorAll<HTMLAnchorElement>("#bmc-step-toggle a[data-step]").forEach((anchor) => {
      anchor.classList.toggle("is-active", anchor.dataset.step === step && !generating);
    });

    const credEl = document.getElementById("bmc-cred-readout");
    if (credEl) credEl.textContent = credits + (credits === 1 ? " credit" : " credits");
  }, [step, generating, credits, refreshCredits]);

  const isReview = step === "review";

  return (
    <>
      {isReview ? (
        <BmcReview
          generating={generating}
          includeSong={includeSong}
          credits={credits}
          onStartOver={startOver}
          onTopUp={openPricingForCredits}
          onRegenerateAsset={spendRegenerationCredit}
          onApproveAll={() => router.push("/delivery")}
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
              {step === "photo" && (
                <BmcPhotoStep
                  key={stepInstanceKey}
                  photoCount={photoCount}
                  setPhotoCount={setPhotoCount}
                  describe={describe}
                  setDescribe={setDescribe}
                  onContinue={goNext}
                  initialDraft={draftInput.creativeBrief}
                  onDraftPatch={updateDraftInput}
                />
              )}
              {step === "basics" && <BmcBasicsStep key={stepInstanceKey} onContinue={goNext} onBack={goBack} initialDraft={draftInput.creativeBrief} onDraftPatch={updateDraftInput} />}
              {step === "image" && <BmcImageStep key={stepInstanceKey} onContinue={goNext} onBack={goBack} hasPhoto={hasPhoto} initialDraft={draftInput.creativeBrief} onDraftPatch={updateDraftInput} />}
              {step === "message" && <BmcMessageStep key={stepInstanceKey} onContinue={goNext} onBack={goBack} initialDraft={draftInput.creativeBrief} onDraftPatch={updateDraftInput} />}
              {step === "song" && (
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
