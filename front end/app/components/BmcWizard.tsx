"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { STEPS, BmcNavContext, BmcErrorModal } from "./BmcShared";
import { BmcPhotoStep, BmcBasicsStep, BmcImageStep, BmcMessageStep, BmcSongStep } from "./BmcSteps";
import { BmcReview } from "./BmcReview";
import { PricingReceiveModal } from "./Options";
import { MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";
import { getTotalDemoCredits, spendDemoCredits } from "./DemoBalance";
import { addGeneratedSouvenote } from "./DemoLibrary";

export type BmcWizardStep = "photo" | "basics" | "image" | "message" | "song" | "review";

type BmcWizardProps = {
  initialStep?: BmcWizardStep;
  credits?: number;
  setCredits?: React.Dispatch<React.SetStateAction<number>>;
  cardBank?: number;
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
  credits = 6,
  setCredits = () => {},
  cardBank = 0,
}: BmcWizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<BmcWizardStep>(initialStep);
  const [photoCount, setPhotoCount] = React.useState(0);
  const [describe, setDescribe] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [pricing, setPricing] = React.useState(false);
  const [pricingMode, setPricingMode] = React.useState<"credits" | "full">("credits");

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
    if (cardBank <= 0) {
      router.push(goToPricingAfterPurchase("/create"));
      return;
    }

    setPricingMode("credits");
    setPricing(true);
  };

  const onGenerate = () => {
    if (credits < MIN_GENERATION_CREDITS) {
      openPricingForCredits();
      return;
    }

    const nextBalance = spendDemoCredits(2);
    setCredits(getTotalDemoCredits(nextBalance));
    addGeneratedSouvenote({
      title: "Build My Card Souvenote",
      palette: "rose",
      glyph: "S",
      songName: "Build My Card Song",
    });
    setStep("review");
    setGenerating(true);
    window.location.hash = "review";
    window.setTimeout(() => setGenerating(false), 5200);
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
    window.__bmcSetCredits = (nextCredits) => setCredits(nextCredits);

    document.querySelectorAll<HTMLAnchorElement>("#bmc-step-toggle a[data-step]").forEach((anchor) => {
      anchor.classList.toggle("is-active", anchor.dataset.step === step && !generating);
    });

    const credEl = document.getElementById("bmc-cred-readout");
    if (credEl) credEl.textContent = credits + (credits === 1 ? " credit" : " credits");
  }, [step, generating, credits, setCredits]);

  const isReview = step === "review";

  return (
    <>
      {isReview ? (
        <BmcReview
          generating={generating}
          credits={credits}
          onStartOver={startOver}
          onTopUp={openPricingForCredits}
          onApproveAll={() => router.push("/delivery")}
        />
      ) : (
        <div className="bmc-shell">
          <div className="bmc-headcard" aria-hidden="true">
            <div className="bmc-headcard-spin">
              <div className="bmc-headcard-face bmc-headcard-front">
                <img src="/assets/bmc-souvenote-card-face.png" alt="" />
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
              {step === "song" && <BmcSongStep onBack={goBack} onGenerate={onGenerate} />}
            </>
          </BmcNavContext.Provider>
        </div>
      )}

      <PricingReceiveModal open={pricing} onClose={() => setPricing(false)} currency="CAD" mode={pricingMode} />
      <BmcErrorModal />
    </>
  );
}

export { BmcWizard };
