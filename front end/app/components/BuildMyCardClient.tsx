"use client";

import * as React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { BmcWizard } from "./BmcWizard";
import { demoUser } from "./DemoUser";
import { getTotalDemoCredits, useDemoBalance } from "./DemoBalance";
import type { DemoBalance } from "./DemoBalance";

type BuildStep = "photo" | "basics" | "image" | "message" | "song" | "review";

const validSteps = new Set<BuildStep>(["photo", "basics", "image", "message", "song", "review"]);
const BUILD_MY_CARD_DEFAULT_BALANCE: DemoBalance = { credits: { images: 6, songs: 0 }, cardBank: 3 };

function isBuildStep(value: string): value is BuildStep {
  return validSteps.has(value as BuildStep);
}

export function BuildMyCardClient() {
  const [initialStep, setInitialStep] = React.useState<BuildStep>("photo");
  const demoBalance = useDemoBalance(BUILD_MY_CARD_DEFAULT_BALANCE);
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

  return (
    <div className="souv-route-page">
      <PageChrome variant="bmc" />
      <div className="bmc-page">
        <Navbar loggedIn user={demoUser} credits={{ images: credits, songs: 0 }} cardBank={demoBalance.cardBank} cartCount={0} />
        <main><BmcWizard initialStep={initialStep} credits={credits} setCredits={setCredits} cardBank={demoBalance.cardBank} /></main>
        <Footer />
      </div>
    </div>
  );
}
