export type PricingModalMode = "full" | "credits" | "cards";

export type CreateGateRequirement = "generation" | "send";

export type AccountBalance = {
  credits: {
    images: number;
    songs: number;
  };
  cardBank: number;
};

export const demoAccountBalance: AccountBalance = {
  credits: { images: 7, songs: 3 },
  cardBank: 1,
};

export type CreateFlowGate =
  | { allowed: true }
  | {
      allowed: false;
      modalMode: PricingModalMode;
      reason: "credits" | "cards" | "credits-and-cards";
    };

export function getTotalCredits(balance: AccountBalance) {
  return balance.credits.images + balance.credits.songs;
}

export function getCreateFlowGate(
  balance: AccountBalance,
  requirement: CreateGateRequirement,
): CreateFlowGate {
  const hasCredits = getTotalCredits(balance) > 0;
  const hasCards = balance.cardBank > 0;

  if (requirement === "generation" && !hasCredits) {
    return {
      allowed: false,
      modalMode: hasCards ? "credits" : "full",
      reason: hasCards ? "credits" : "credits-and-cards",
    };
  }

  if (requirement === "send" && !hasCards) {
    return {
      allowed: false,
      modalMode: hasCredits ? "cards" : "full",
      reason: hasCredits ? "cards" : "credits-and-cards",
    };
  }

  return { allowed: true };
}
