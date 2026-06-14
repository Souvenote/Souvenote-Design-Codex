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

export const MIN_GENERATION_CREDITS = 1;
export const CARD_WITH_QR_SONG_CREDITS = 2;

export type CreateFlowGate =
  | { allowed: true }
  | {
      allowed: false;
      reason: "credits" | "cards" | "credits-and-cards";
    };

export function getTotalCredits(balance: AccountBalance) {
  return balance.credits.images + balance.credits.songs;
}

export function getCreateFlowGate(
  balance: AccountBalance,
  requirement: CreateGateRequirement,
): CreateFlowGate {
  const totalCredits = getTotalCredits(balance);
  const hasCredits = totalCredits > 0;
  const hasGenerationCredits = totalCredits >= MIN_GENERATION_CREDITS;
  const hasCards = balance.cardBank > 0;

  if (requirement === "generation" && !hasGenerationCredits) {
    return {
      allowed: false,
      reason: hasCards ? "credits" : "credits-and-cards",
    };
  }

  if (requirement === "send" && !hasCards) {
    return {
      allowed: false,
      reason: hasCredits ? "cards" : "credits-and-cards",
    };
  }

  return { allowed: true };
}
