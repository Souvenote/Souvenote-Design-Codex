export const DELIVERY_CONFIRMATION_STEPS = [
  "Order confirmed",
  "In production",
  "Shipped",
  "Delivered",
] as const;

export type DeliveryConfirmationTone = "neutral" | "active" | "success" | "warning";

export type DeliveryConfirmationPresentation = {
  heading: string;
  description: string;
  statusLabel: string;
  activeStep: number;
  tone: DeliveryConfirmationTone;
  shouldPoll: boolean;
};

const LABELS: Record<string, string> = {
  pending: "Order created",
  checkout_started: "Checkout started",
  payment_authorized: "Payment authorized",
  paid: "Payment received",
  paid_mock: "Preview payment complete",
  fulfillment_started: "Preparing for production",
  fulfillment_submitted: "Submitted for production",
  printing: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  fulfillment_on_hold: "On hold",
  fulfillment_failed: "Fulfillment needs attention",
  fulfilled_mock: "Preview fulfillment complete",
  failed_mock: "Preview fulfillment failed",
  payment_failed: "Payment failed",
  payment_canceled: "Payment canceled",
  checkout_expired: "Checkout expired",
  closed_no_send: "Closed without sending",
};

export function deliveryStatusLabel(status: string | null | undefined) {
  if (!status) return "Awaiting order";
  return LABELS[status] || status.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function deliveryConfirmationPresentation(
  status: string | null | undefined,
  statusReason?: string | null,
): DeliveryConfirmationPresentation {
  const normalized = status || "";

  if (normalized === "delivered") {
    return {
      heading: "Delivered with care",
      description: "Your Souvenote has reached its destination. We hope it becomes a keepsake.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 3,
      tone: "success",
      shouldPoll: false,
    };
  }

  if (normalized === "fulfilled_mock") {
    return {
      heading: "Preview fulfilled",
      description: "The local fulfillment preview completed without contacting an external print service.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 3,
      tone: "success",
      shouldPoll: false,
    };
  }

  if (normalized === "shipped") {
    return {
      heading: "Your card is on its way",
      description: "Your Souvenote has left production and is travelling to its recipient.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 2,
      tone: "active",
      shouldPoll: true,
    };
  }

  if (["fulfillment_started", "fulfillment_submitted", "printing"].includes(normalized)) {
    return {
      heading: "Your card is in production",
      description: "We have everything we need. Your Souvenote is being prepared, printed, and readied for mailing.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 1,
      tone: "active",
      shouldPoll: true,
    };
  }

  if (["fulfillment_on_hold", "fulfillment_failed", "failed_mock"].includes(normalized)) {
    return {
      heading: "Your order needs attention",
      description: statusReason || "We paused this order while its fulfillment result is reviewed. It will not be submitted twice.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 1,
      tone: "warning",
      shouldPoll: false,
    };
  }

  if (["paid", "paid_mock", "payment_authorized"].includes(normalized)) {
    return {
      heading: "Your order is confirmed",
      description: "Checkout is complete. Your Souvenote is queued for production and mailing.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 0,
      tone: "active",
      shouldPoll: true,
    };
  }

  if (["payment_failed", "payment_canceled", "checkout_expired", "closed_no_send"].includes(normalized)) {
    return {
      heading: "Checkout is not complete",
      description: "Return to Delivery to review this order and restart checkout when you are ready.",
      statusLabel: deliveryStatusLabel(normalized),
      activeStep: 0,
      tone: "warning",
      shouldPoll: false,
    };
  }

  return {
    heading: "Order confirmation",
    description: "We are loading the latest secure order and fulfillment details.",
    statusLabel: deliveryStatusLabel(normalized),
    activeStep: 0,
    tone: "neutral",
    shouldPoll: normalized === "checkout_started",
  };
}

export function deliveryOrderNumber(orderId: string | null | undefined) {
  return orderId ? `SVN-${orderId.slice(0, 8).toUpperCase()}` : "Not available";
}

export function formatOrderMoney(amountCents: number | null | undefined, currency = "CAD") {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return "Not available";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export function formatOrderDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function recordText(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatRecipientSummary(
  address: Record<string, unknown> | null | undefined,
  quantity = 1,
) {
  const name = recordText(address, "name");
  const location = [recordText(address, "city"), recordText(address, "region")]
    .filter(Boolean)
    .join(", ");
  const base = [name, location].filter(Boolean).join(" · ") || "Recipient details protected";
  return quantity > 1 ? `${base} + ${quantity - 1} more` : base;
}

export function safeTrackingUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
