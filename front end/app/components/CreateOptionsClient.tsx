"use client";

import { useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BackButton, OptionsHeader, TileGrid } from "./Options";
import { PageChrome } from "./PageChrome";
import { useCreditBalance } from "../lib/creditBalance";
import { useDemoBalance, ZERO_DEMO_BALANCE } from "./DemoBalance";
import {
  getCreateFlowGate,
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
  const demoBalance = useDemoBalance(ZERO_DEMO_BALANCE);
  const creditBalance = useCreditBalance({ fallbackBalance: 0 });
  const accountBalance = {
    credits: { images: creditBalance.balance, songs: 0 },
    cardBank: demoBalance.cardBank,
  };
  const totalCredits = creditBalance.balance;

  function handleTileSelect(tile: CreateTile) {
    if (tile.requiresCredits) {
      const gate = getCreateFlowGate(accountBalance, "generation");

      if (!gate.allowed) {
        router.push(goToPricingAfterPurchase(tile.href));
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
          cardBank={demoBalance.cardBank}
          cartCount={0}
        />
        <main>
          <OptionsHeader user={user} credits={totalCredits} lowBalance={totalCredits < 1} />
          <TileGrid
            credits={totalCredits}
            cardBank={demoBalance.cardBank}
            onSelect={handleTileSelect}
          />
          <BackButton href="/home" label="Back to home" />
        </main>
        <Footer />
      </div>
    </div>
  );
}
