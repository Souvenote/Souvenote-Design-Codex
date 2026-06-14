"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BackButton, OptionsHeader, TileGrid } from "./Options";
import { PageChrome } from "./PageChrome";
import { getTotalDemoCredits, useDemoBalance } from "./DemoBalance";
import {
  demoAccountBalance,
  getCreateFlowGate,
} from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };

type CreateTile = {
  href: string;
  title: string;
  requiresCredits?: boolean;
};

type GateModalState = {
  title: string;
  eyebrow: string;
  body: string;
  cta: string;
} | null;

export function CreateOptionsClient() {
  const router = useRouter();
  const accountBalance = useDemoBalance(demoAccountBalance);
  const totalCredits = getTotalDemoCredits(accountBalance);
  const [gateModal, setGateModal] = useState<GateModalState>(null);

  function handleTileSelect(tile: CreateTile) {
    if (tile.requiresCredits) {
      const gate = getCreateFlowGate(accountBalance, "generation");

      if (!gate.allowed) {
        setGateModal(gate.reason === "credits"
          ? {
              eyebrow: "Credits required",
              title: "Top up credits",
              body: "You still have cards in your bank, but generating a new image, edit, message, or optional QR-code song needs at least one credit.",
              cta: "Top up credits",
            }
          : {
              eyebrow: "Cards and credits required",
              title: "Top up cards/credits",
              body: "Choose a card pack or credit top-up first. After checkout, you'll return to the four create options with your balance ready.",
              cta: "View pricing",
            });
        return;
      }
    }

    router.push(tile.href);
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
          <OptionsHeader user={user} credits={totalCredits} lowBalance={false} />
          <TileGrid
            credits={totalCredits}
            cardBank={accountBalance.cardBank}
            onSelect={handleTileSelect}
          />
          <BackButton href="/home" label="Back to home" />
        </main>
        <Footer />
      </div>
      {gateModal && (
        <div className="opt-gate-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="opt-gate-title">
          <button type="button" className="opt-gate-scrim" aria-label="Close" onClick={() => setGateModal(null)} />
          <div className="opt-gate-modal">
            <button type="button" className="opt-gate-close" aria-label="Close" onClick={() => setGateModal(null)}>{"\u00d7"}</button>
            <div className="opt-gate-eyebrow">{gateModal.eyebrow}</div>
            <h2 id="opt-gate-title" className="opt-gate-title">{gateModal.title}</h2>
            <p className="opt-gate-body">{gateModal.body}</p>
            <div className="opt-gate-actions">
              <button type="button" className="bmc-cta-secondary opt-gate-secondary" onClick={() => setGateModal(null)}>Not now</button>
              <button
                type="button"
                className="bmc-cta opt-gate-primary"
                onClick={() => router.push(goToPricingAfterPurchase("/create"))}
              >
                {gateModal.cta} <span aria-hidden="true">{"\u2192"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
