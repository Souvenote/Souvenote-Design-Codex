"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageChrome } from "./PageChrome";
import { PersonalizeApp } from "./Personalize";
import { demoUser } from "./DemoUser";
import { getTotalDemoCredits, useDemoBalance, ZERO_DEMO_BALANCE } from "./DemoBalance";
import { MIN_GENERATION_CREDITS } from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

export function PersonalizeTemplateClient() {
  const router = useRouter();
  const [openModal, setOpenModal] = React.useState(false);
  const [balanceReady, setBalanceReady] = React.useState(false);
  const entryGateChecked = React.useRef(false);
  const demoBalance = useDemoBalance(ZERO_DEMO_BALANCE);
  const totalCredits = getTotalDemoCredits(demoBalance);

  React.useEffect(() => {
    setOpenModal(new URLSearchParams(window.location.search).get("modal") === "1");
  }, []);

  React.useEffect(() => {
    setBalanceReady(true);
  }, []);

  React.useEffect(() => {
    if (!balanceReady || entryGateChecked.current) return;
    entryGateChecked.current = true;
    if (totalCredits < MIN_GENERATION_CREDITS) {
      router.replace(goToPricingAfterPurchase("/create/personalize-a-template"));
    }
  }, [balanceReady, totalCredits, router]);

  return (
    <div className="souv-route-page">
      <PageChrome variant="personalize" />
      <Navbar loggedIn user={demoUser} credits={demoBalance.credits} cardBank={demoBalance.cardBank} cartCount={0} />
      <main><PersonalizeApp openModal={openModal} accountBalance={demoBalance} /></main>
      <Footer />
    </div>
  );
}
