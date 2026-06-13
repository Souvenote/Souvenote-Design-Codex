"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BackButton, PricingReceiveModal } from "./Options";
import { PageChrome } from "./PageChrome";
import {
  demoAccountBalance,
  getCreateFlowGate,
  type CreateGateRequirement,
  type PricingModalMode,
} from "./createFlowRules";
import { useDemoBalance } from "./DemoBalance";
import { goToPricingAfterPurchase } from "./PricingReturn";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };

type CreateFlowPlaceholderProps = {
  title: string;
  description: string;
  actions?: CreateFlowAction[];
};

type CreateFlowAction = {
  label: string;
  description: string;
  requirement: CreateGateRequirement;
  readyMessage: string;
};

export function CreateFlowPlaceholder({
  title,
  description,
  actions = [],
}: CreateFlowPlaceholderProps) {
  const router = useRouter();
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [pricingModalMode, setPricingModalMode] = useState<PricingModalMode>("full");
  const [readyMessage, setReadyMessage] = useState("");
  const accountBalance = useDemoBalance(demoAccountBalance);

  function handleAction(action: CreateFlowAction) {
    const gate = getCreateFlowGate(accountBalance, action.requirement);

    if ("modalMode" in gate) {
      if (gate.modalMode === "full") {
        router.push(goToPricingAfterPurchase("/create"));
        return;
      }

      setReadyMessage("");
      setPricingModalMode(gate.modalMode);
      setPricingModalOpen(true);
      return;
    }

    setReadyMessage(action.readyMessage);
  }

  return (
    <div className="souv-route-page">
      <PageChrome variant="options" />
      <div className="opt-page">
        <Navbar
          loggedIn
          user={user}
          credits={accountBalance.credits}
          cardBank={accountBalance.cardBank}
          cartCount={0}
        />
        <main>
          <section className="opt-head" data-screen-label={`${title} Placeholder`}>
            <div className="opt-head-inner">
              <div className="souv-eyebrow opt-eyebrow">COMING SOON</div>
              <h1 className="souv-hero-title opt-title">
                <span className="souv-hero-italic text-metallic-rose-gold">{title}</span>
              </h1>
              <p className="opt-lede">{description}</p>
            </div>
          </section>
          {actions.length > 0 && (
            <section className="opt-flow-actions" aria-label={`${title} flow checks`}>
              <div className="opt-flow-actions-inner">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="opt-flow-action"
                    onClick={() => handleAction(action)}
                  >
                    <span className="opt-flow-action-label">{action.label}</span>
                    <span className="opt-flow-action-description">{action.description}</span>
                  </button>
                ))}
              </div>
              {readyMessage && (
                <p className="opt-flow-ready" role="status">
                  {readyMessage}
                </p>
              )}
            </section>
          )}
          <BackButton href="/create" label="Back to options" />
        </main>
        <Footer />
      </div>
      <PricingReceiveModal
        open={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        currency="CAD"
        mode={pricingModalMode}
      />
    </div>
  );
}
