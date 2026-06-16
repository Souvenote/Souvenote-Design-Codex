export type CreateGateRequirement = "generation";

export type AccountBalance = {
  credits: {
    images: number;
    songs: number;
  };
  cardBank: number;
};

export const MIN_GENERATION_CREDITS = 1;
export const CARD_WITH_QR_SONG_CREDITS = 2;

export type CreateFlowGate = { allowed: true } | { allowed: false };

export function getTotalCredits(balance: AccountBalance) {
  return balance.credits.images + balance.credits.songs;
}

export function getCreateFlowGate(
  balance: AccountBalance,
  requirement: CreateGateRequirement,
): CreateFlowGate {
  const totalCredits = getTotalCredits(balance);
  const hasGenerationCredits = totalCredits >= MIN_GENERATION_CREDITS;

  if (requirement === "generation" && !hasGenerationCredits) {
    return { allowed: false };
  }

  return { allowed: true };
}
