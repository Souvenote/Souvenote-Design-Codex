import { describe, expect, it } from "vitest";
import {
  BIG_SENDER_TIERS,
  MAX_BIG_SENDER_CARDS,
  MIN_BIG_SENDER_CARDS,
  clampBigSenderQuantity,
  getBigSenderPricing,
  makeBigSenderCartItem,
  makeTryRiskFreeCartItem,
} from "./pricingCatalog";

describe("Canada-first pricing decisions", () => {
  it("enforces the two-card Big Sender minimum", () => {
    expect(MIN_BIG_SENDER_CARDS).toBe(2);
    expect(clampBigSenderQuantity(1)).toBe(2);
    expect(getBigSenderPricing(2)).toMatchObject({
      qty: 2,
      total: 17.98,
    });
  });

  it("keeps the approved Big Sender tiers bounded at 30 cards", () => {
    expect(BIG_SENDER_TIERS).toEqual([
      { min: 2, max: 10, pricePerCard: 8.99, label: "2-10 cards" },
      { min: 11, max: 20, pricePerCard: 7.99, label: "11-20 cards" },
      { min: 21, max: 30, pricePerCard: 6.99, label: "21-30 cards" },
    ]);
    expect(clampBigSenderQuantity(31)).toBe(MAX_BIG_SENDER_CARDS);
  });

  it("freezes the chosen Big Sender quantity in one cart line", () => {
    expect(makeBigSenderCartItem(11)).toMatchObject({
      id: "pack-bigsender",
      price: 87.89,
      qty: 1,
      cardCount: 11,
      creditsPerCard: 10,
      lockedQuantity: true,
      unitNote: "$7.99 / card",
    });
  });

  it("describes the five-day flat-fee Try Risk-Free rule", () => {
    expect(makeTryRiskFreeCartItem()).toMatchObject({
      price: 9.99,
      cardCount: 1,
      creditsPerCard: 10,
    });
    expect(makeTryRiskFreeCartItem().sub).toContain("5-day hold");
    expect(makeTryRiskFreeCartItem().sub).toContain("flat CA$2");
  });
});
