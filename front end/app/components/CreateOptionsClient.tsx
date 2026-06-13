"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BackButton, OptionsHeader, PricingReceiveModal, TileGrid } from "./Options";
import { PageChrome } from "./PageChrome";
import { getTotalDemoCredits, useDemoBalance } from "./DemoBalance";
import {
  demoAccountBalance,
  getCreateFlowGate,
  type PricingModalMode,
} from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

const user = { name: "Cameron Wilson", email: "cameron@souvenote.com", initials: "CW" };

type CreateTile = {
  href: string;
  title: string;
  requiresCredits?: boolean;
};

export function CreateOptionsClient() {
  const router = useRouter();
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [pricingModalMode, setPricingModalMode] = useState<PricingModalMode>("full");
  const accountBalance = useDemoBalance(demoAccountBalance);
  const totalCredits = getTotalDemoCredits(accountBalance);

  function handleTileSelect(tile: CreateTile) {
    if (tile.requiresCredits) {
      const gate = getCreateFlowGate(accountBalance, "generation");

      if ("modalMode" in gate) {
        if (gate.modalMode === "full") {
          router.push(goToPricingAfterPurchase("/create"));
          return;
        }

        setPricingModalMode(gate.modalMode);
        setPricingModalOpen(true);
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
      <PricingReceiveModal
        open={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        currency="CAD"
        mode={pricingModalMode}
      />
    </div>
  );
}
