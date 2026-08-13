"use client";

import { useRouter } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { BackButton, OptionsHeader, TileGrid } from "./Options";
import { PageChrome } from "./PageChrome";
import { useAuth } from "./AuthProvider";
import { useCreditBalance } from "../lib/creditBalance";
import { useCardEntitlementBalance } from "../lib/cardEntitlementBalance";
import {
  getCreateFlowGate,
} from "./createFlowRules";
import { goToPricingAfterPurchase } from "./PricingReturn";

const fallbackUser = { name: "Souvenote User", email: "user@souvenote.com", initials: "SU" };

type CreateTile = {
  href: string;
  title: string;
  requiresCredits?: boolean;
};

export function CreateOptionsClient() {
  const router = useRouter();
  const auth = useAuth();
  const isAuthenticated = auth.status === "authenticated";
  const creditBalance = useCreditBalance({ enabled: isAuthenticated, fallbackBalance: 0, userId: auth.user?.id });
  const cardBalance = useCardEntitlementBalance({ enabled: isAuthenticated, fallbackBalance: 0, userId: auth.user?.id });
  const user = auth.displayUser || fallbackUser;
  const accountBalance = {
    credits: { images: creditBalance.balance, songs: 0 },
    cardBank: cardBalance.balance,
  };
  const totalCredits = creditBalance.balance;

  function handleTileSelect(tile: CreateTile) {
    if (!isAuthenticated) {
      router.push(tile.href);
      return;
    }

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
          loggedIn={isAuthenticated}
          user={user}
          credits={accountBalance.credits}
          cardBank={accountBalance.cardBank}
          cartCount={0}
        />
        <main>
          <OptionsHeader />
          <TileGrid
            credits={totalCredits}
            cardBank={accountBalance.cardBank}
            onSelect={handleTileSelect}
          />
          <BackButton href="/home" label="Back to home" />
        </main>
        <Footer />
      </div>
    </div>
  );
}
