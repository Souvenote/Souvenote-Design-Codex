"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { BmcWizard } from "./BmcWizard";
import { demoUser } from "./DemoUser";
import { getTotalDemoCredits, useDemoBalance, ZERO_DEMO_BALANCE } from "./DemoBalance";
import { MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

type BuildStep = "photo" | "basics" | "image" | "message" | "song" | "review";

const validSteps = new Set<BuildStep>(["photo", "basics", "image", "message", "song", "review"]);

function isBuildStep(value: string): value is BuildStep {
  return validSteps.has(value as BuildStep);
}

export function BuildMyCardClient() {
  const router = useRouter();
  const [initialStep, setInitialStep] = React.useState<BuildStep>("photo");
  const [balanceReady, setBalanceReady] = React.useState(false);
  const entryGateChecked = React.useRef(false);
  const demoBalance = useDemoBalance(ZERO_DEMO_BALANCE);
  const demoCreditTotal = getTotalDemoCredits(demoBalance);
  const [credits, setCredits] = React.useState(demoCreditTotal);

  React.useEffect(() => {
    const syncHashStep = () => {
      const hash = window.location.hash.replace("#", "");
      if (isBuildStep(hash)) setInitialStep(hash);
    };
    syncHashStep();
    window.addEventListener("hashchange", syncHashStep);
    return () => window.removeEventListener("hashchange", syncHashStep);
  }, []);

  React.useEffect(() => {
    setCredits(demoCreditTotal);
  }, [demoCreditTotal]);

  React.useEffect(() => {
    setBalanceReady(true);
  }, []);

  React.useEffect(() => {
    if (!balanceReady || entryGateChecked.current) return;
    entryGateChecked.current = true;
    if (demoCreditTotal < MIN_GENERATION_CREDITS) {
      router.replace(goToPricingAfterPurchase("/create/build-my-card"));
    }
  }, [balanceReady, demoCreditTotal, router]);

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar loggedIn user={demoUser} credits={{ images: credits, songs: 0 }} cardBank={demoBalance.cardBank} cartCount={0} />
        <main><BmcWizard initialStep={initialStep} credits={credits} setCredits={setCredits} /></main>
        <Footer />
      </div>
    </div>
  );
}
