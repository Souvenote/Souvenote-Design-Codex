export const MIN_BIG_SENDER_CARDS = 2;
export const MAX_BIG_SENDER_CARDS = 30;

export type BigSenderTier = {
  min: number;
  max: number;
  pricePerCard: number;
  label: string;
};

export type PricingCartItem = {
  id: string;
  type: "pack";
  name: string;
  meta: string;
  sub: string;
  price: number;
  qty: number;
  cardCount: number;
  lockedQuantity: boolean;
  replaceGroup: string;
  unitNote: string;
};

export const SOUV_CART_KEY = "souv_cart";

export type BigSenderPricing = {
  qty: number;
  tier: BigSenderTier;
  total: number;
  totalText: string;
};

export const BIG_SENDER_TIERS: BigSenderTier[] = [
  { min: 2, max: 10, pricePerCard: 8.99, label: "2-10 cards" },
  { min: 11, max: 20, pricePerCard: 7.99, label: "11-20 cards" },
  { min: 21, max: 30, pricePerCard: 6.99, label: "21-30+ cards" },
];

export function clampBigSenderQuantity(nextRaw: unknown): number {
  const parsed = Math.floor(Number(nextRaw) || MIN_BIG_SENDER_CARDS);
  return Math.max(MIN_BIG_SENDER_CARDS, Math.min(MAX_BIG_SENDER_CARDS, parsed));
}

export function getBigSenderTier(quantity: unknown): BigSenderTier {
  const qty = clampBigSenderQuantity(quantity);
  return BIG_SENDER_TIERS.find((tier) => qty >= tier.min && qty <= tier.max) || BIG_SENDER_TIERS[BIG_SENDER_TIERS.length - 1];
}

export function getBigSenderPricing(quantity: unknown): BigSenderPricing {
  const qty = clampBigSenderQuantity(quantity);
  const tier = getBigSenderTier(qty);
  const total = +(qty * tier.pricePerCard).toFixed(2);
  return {
    qty,
    tier,
    total,
    totalText: total.toFixed(2),
  };
}

export function makeBigSenderCartItem(quantity: unknown): PricingCartItem {
  const pricing = getBigSenderPricing(quantity);
  return {
    id: "pack-bigsender",
    type: "pack",
    name: "Big Sender",
    meta: `${pricing.qty} cards · shipping included`,
    sub: "Send multiple different cards, 10 AI credits per card.",
    price: pricing.total,
    qty: 1,
    cardCount: pricing.qty,
    lockedQuantity: true,
    replaceGroup: "pack-bigsender",
    unitNote: `$${pricing.tier.pricePerCard.toFixed(2)} / card`,
  };
}

export function makeTryRiskFreeCartItem(): PricingCartItem {
  return {
    id: "pack-try-risk-free",
    type: "pack",
    name: "Try Risk-Free",
    meta: "1 card · shipping included",
    sub: "Temporary 5-day hold. Finalized only if the card is sent.",
    price: 9.99,
    qty: 1,
    cardCount: 1,
    lockedQuantity: true,
    replaceGroup: "pack-try-risk-free",
    unitNote: "$9.99 hold",
  };
}

export function makeSingleCardSendCartItem(): PricingCartItem {
  return {
    id: "pack-send-this-card",
    type: "pack",
    name: "Send This Card",
    meta: "1 card · shipping included",
    sub: "Send the Souvenote you just created.",
    price: 6.99,
    qty: 1,
    cardCount: 1,
    lockedQuantity: true,
    replaceGroup: "pack-send-this-card",
    unitNote: "$6.99 / card",
  };
}

export function addPricingCartItemToCart(item: PricingCartItem): void {
  if (typeof window === "undefined") return;

  try {
    const raw = JSON.parse(window.localStorage.getItem(SOUV_CART_KEY) || "[]");
    let current = Array.isArray(raw) ? raw : [];
    if (item.replaceGroup) {
      current = current.filter((candidate) => candidate?.replaceGroup !== item.replaceGroup && candidate?.id !== item.id);
    }
    const existing = item.replaceGroup ? null : current.find((candidate) => candidate?.id === item.id);
    if (existing) existing.qty += item.qty || 1;
    else current.push(item);
    window.localStorage.setItem(SOUV_CART_KEY, JSON.stringify(current));
  } catch {
    // Cart storage is best-effort in the local prototype.
  }
}
