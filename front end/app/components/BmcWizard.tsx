"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createLocalIdempotencyKey, startGeneration } from "../lib/api";
import { publishCreditBalance } from "../lib/creditBalance";
import type { CreditBalanceStatus } from "../lib/creditBalance";
import { STEPS, BmcNavContext, BmcErrorModal, bmcError } from "./BmcShared";
import { BmcPhotoStep, BmcBasicsStep, BmcImageStep, BmcMessageStep, BmcSongStep } from "./BmcSteps";
import { BmcReview } from "./BmcReview";
import { CARD_WITH_QR_SONG_CREDITS, MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";
import { addGeneratedSouvenote } from "./DemoLibrary";

export type BmcWizardStep = "photo" | "basics" | "image" | "message" | "song" | "review";

type BmcWizardProps = {
  initialStep?: BmcWizardStep;
  credits?: number;
  creditStatus?: CreditBalanceStatus;
  refreshCredits?: () => Promise<unknown> | unknown;
};

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

  const hasPhoto = photoCount > 0 && !describe;
  const idx = STEPS.findIndex((candidate) => candidate.id === step);

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
    if (idx >= 0 && idx < STEPS.length - 1 && isBmcWizardStep(nextStep)) goTo(nextStep);
  };

  const goBack = () => {
    const previousStep = STEPS[idx - 1]?.id;
    if (idx > 0 && isBmcWizardStep(previousStep)) goTo(previousStep);
  };

  const openPricingForCredits = () => {
    router.push(goToPricingAfterPurchase("/create/build-my-card"));
  };

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
      const response = await startGeneration({
        idempotencyKey: createLocalIdempotencyKey("build-my-card-generation"),
      });

      if (response.balance) {
        publishCreditBalance(response.balance);
      } else {
        await refreshCredits?.();
      }

      addGeneratedSouvenote({
        title: "Build My Card Souvenote",
        palette: "rose",
        glyph: "S",
        includeSong,
        songName: includeSong ? "Build My Card QR Song" : undefined,
      });
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
        idempotencyKey: createLocalIdempotencyKey("build-my-card-regenerate"),
      });

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
                  photoCount={photoCount}
                  setPhotoCount={setPhotoCount}
                  describe={describe}
                  setDescribe={setDescribe}
                  onContinue={goNext}
                />
              )}
              {step === "basics" && <BmcBasicsStep onContinue={goNext} onBack={goBack} />}
              {step === "image" && <BmcImageStep onContinue={goNext} onBack={goBack} hasPhoto={hasPhoto} />}
              {step === "message" && <BmcMessageStep onContinue={goNext} onBack={goBack} />}
              {step === "song" && (
                <BmcSongStep
                  includeSong={includeSong}
                  setIncludeSong={setIncludeSong}
                  onBack={goBack}
                  onGenerate={onGenerate}
                  generating={startingGeneration}
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
