"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { PersonalizeApp } from "./Personalize";
import { demoUser } from "./DemoUser";
import { useCreditBalance } from "../lib/creditBalance";
import { MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";
import { useAuth } from "./AuthProvider";

type PersonalizeModalStep = "photo" | "birthday" | "caption";

function isPersonalizeModalStep(value: string | null): value is PersonalizeModalStep {
  return value === "photo" || value === "birthday" || value === "caption";
}

export function PersonalizeTemplateClient() {
  const router = useRouter();
  const auth = useAuth();
  const [openModal, setOpenModal] = React.useState(false);
  const [initialModalStep, setInitialModalStep] = React.useState<PersonalizeModalStep>("photo");
  const [resumeDraftId, setResumeDraftId] = React.useState<string | null>(null);
  const [balanceReady, setBalanceReady] = React.useState(false);
  const entryGateChecked = React.useRef(false);
  const isAuthenticated = auth.status === "authenticated";
  const creditBalance = useCreditBalance({ enabled: isAuthenticated, fallbackBalance: 0, userId: auth.user?.id });
  const totalCredits = creditBalance.balance;
  const accountBalance = {
    credits: { images: totalCredits, songs: 0 },
    cardBank: 0,
  };

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOpenModal(params.get("modal") === "1");
    setResumeDraftId(params.get("draftId"));
    const requestedStep = params.get("step");
    setInitialModalStep(isPersonalizeModalStep(requestedStep) ? requestedStep : "photo");
  }, []);

  React.useEffect(() => {
    setBalanceReady(true);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated || !balanceReady || entryGateChecked.current || resumeDraftId) return;
    if (creditBalance.status !== "ready") return;
    entryGateChecked.current = true;
    if (totalCredits < MIN_GENERATION_CREDITS) {
      router.replace(goToPricingAfterPurchase("/create/personalize-a-template"));
    }
  }, [balanceReady, creditBalance.status, isAuthenticated, resumeDraftId, totalCredits, router]);

  return (
    <div className="souv-route-page">
      <PageChrome variant="personalize" />
      <Navbar loggedIn={isAuthenticated} user={demoUser} credits={accountBalance.credits} cardBank={0} cartCount={0} />
      <main>
        <PersonalizeApp
          openModal={openModal}
          resumeDraftId={resumeDraftId}
          initialModalStep={initialModalStep}
          accountBalance={accountBalance}
          creditStatus={creditBalance.status}
          refreshCredits={creditBalance.refresh}
          requireAuthToContinue={!isAuthenticated}
        />
      </main>
      <Footer />
    </div>
  );
}
