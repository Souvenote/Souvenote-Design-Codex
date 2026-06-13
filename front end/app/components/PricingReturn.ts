export const PRICING_RETURN_KEY = "souv_pricing_return_to";

function cleanReturnPath(path: unknown): string {
  return typeof path === "string" && path.startsWith("/") ? path : "/create";
}

export function rememberPricingReturn(path = "/create"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRICING_RETURN_KEY, cleanReturnPath(path));
}

export function consumePricingReturn(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.localStorage.getItem(PRICING_RETURN_KEY);
  window.localStorage.removeItem(PRICING_RETURN_KEY);
  return path ? cleanReturnPath(path) : null;
}

export function goToPricingAfterPurchase(path = "/create"): string {
  if (typeof window === "undefined") return "/pricing";
  rememberPricingReturn(path);
  return "/pricing";
}
