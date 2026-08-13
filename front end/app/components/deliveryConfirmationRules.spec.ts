import { describe, expect, it } from "vitest";
import {
  deliveryConfirmationPresentation,
  deliveryOrderNumber,
  formatOrderMoney,
  formatRecipientSummary,
  safeTrackingUrl,
} from "./deliveryConfirmationRules";

describe("delivery confirmation presentation", () => {
  it("maps production, shipping, and delivery to the timeline", () => {
    expect(deliveryConfirmationPresentation("printing")).toMatchObject({ activeStep: 1, tone: "active", shouldPoll: true });
    expect(deliveryConfirmationPresentation("shipped")).toMatchObject({ activeStep: 2, tone: "active", shouldPoll: true });
    expect(deliveryConfirmationPresentation("delivered")).toMatchObject({ activeStep: 3, tone: "success", shouldPoll: false });
  });

  it("surfaces a durable fulfillment hold reason", () => {
    expect(deliveryConfirmationPresentation("fulfillment_on_hold", "Address review required.")).toMatchObject({
      heading: "Your order needs attention",
      description: "Address review required.",
      tone: "warning",
    });
  });

  it("keeps mock completion explicit", () => {
    expect(deliveryConfirmationPresentation("fulfilled_mock")).toMatchObject({
      heading: "Preview fulfilled",
      activeStep: 3,
      tone: "success",
    });
  });
});

describe("delivery confirmation formatting", () => {
  it("formats customer-facing order details", () => {
    expect(deliveryOrderNumber("12345678-abcd-4000-8000-123456789abc")).toBe("SVN-12345678");
    expect(formatOrderMoney(999, "cad")).toBe("$9.99");
    expect(formatRecipientSummary({ name: "Alex Chen", city: "Vancouver", region: "BC" }, 3)).toBe(
      "Alex Chen · Vancouver, BC + 2 more",
    );
  });

  it("allows only secure tracking links", () => {
    expect(safeTrackingUrl("https://carrier.example/track/123")).toBe("https://carrier.example/track/123");
    expect(safeTrackingUrl("http://carrier.example/track/123")).toBeNull();
    expect(safeTrackingUrl("javascript:alert(1)")).toBeNull();
  });
});
