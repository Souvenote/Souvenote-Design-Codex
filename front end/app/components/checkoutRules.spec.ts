import { describe, expect, it } from "vitest";
import {
  calculateCheckoutTotals,
  isCheckoutPromoCode,
  validateCheckoutCard,
} from "./checkoutRules";

describe("checkout pricing rules", () => {
  it("calculates Canadian tax without a promo", () => {
    expect(calculateCheckoutTotals(100, "CA", false)).toEqual({
      subtotal: 100,
      discount: 0,
      tax: 5,
      total: 105,
      taxLabel: "GST (5%)",
    });
  });

  it("applies the promo before tax and rounds currency", () => {
    expect(calculateCheckoutTotals(9.99, "CA", true)).toEqual({
      subtotal: 9.99,
      discount: 1,
      tax: 0.45,
      total: 9.44,
      taxLabel: "GST (5%)",
    });
  });

  it("accepts only the advertised promo code", () => {
    expect(isCheckoutPromoCode(" souvenote10 ")).toBe(true);
    expect(isCheckoutPromoCode("anything-else")).toBe(false);
    expect(isCheckoutPromoCode("")).toBe(false);
  });
});

describe("checkout card validation", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("accepts a valid test card and future expiry", () => {
    expect(validateCheckoutCard({
      number: "4242 4242 4242 4242",
      exp: "12 / 30",
      cvc: "123",
      postal: "V6B 1A1",
    }, now)).toEqual({});
  });

  it("reports invalid and expired card fields", () => {
    expect(validateCheckoutCard({
      number: "4242 4242 4242 4241",
      exp: "07 / 26",
      cvc: "1",
      postal: "",
    }, now)).toEqual({
      number: "Enter a valid card number.",
      exp: "Enter a future expiry date.",
      cvc: "Enter a 3 or 4 digit security code.",
      postal: "Enter your billing postal code.",
    });
  });
});
