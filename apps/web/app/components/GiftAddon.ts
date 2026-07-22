import * as React from "react";

export const BLANK_SOUVENOTE_GIFT_CART_ID = "addon-blank-souvenote";
export const BLANK_SOUVENOTE_GIFT_PRICE = 6.99;
export const BLANK_SOUVENOTE_GIFT_PENDING_KEY = "souv_blank_souvenote_pending";
export const BLANK_SOUVENOTE_GIFT_EVENT = "souv-blank-souvenote-gift";

export function isBlankSouvenoteGiftId(id: unknown): boolean {
  return id === BLANK_SOUVENOTE_GIFT_CART_ID;
}

function normalizeGiftCount(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
}

function notifyBlankGiftCount(count: number): void {
  window.dispatchEvent(new CustomEvent(BLANK_SOUVENOTE_GIFT_EVENT, { detail: count }));
}

export function readBlankSouvenoteGiftCount(): number {
  if (typeof window === "undefined") return 0;

  try {
    return normalizeGiftCount(window.localStorage.getItem(BLANK_SOUVENOTE_GIFT_PENDING_KEY));
  } catch {
    return 0;
  }
}

export function writeBlankSouvenoteGiftCount(count: unknown): number {
  if (typeof window === "undefined") return 0;

  const next = normalizeGiftCount(count);
  try {
    if (next > 0) {
      window.localStorage.setItem(BLANK_SOUVENOTE_GIFT_PENDING_KEY, String(next));
    } else {
      window.localStorage.removeItem(BLANK_SOUVENOTE_GIFT_PENDING_KEY);
    }
  } catch {}
  notifyBlankGiftCount(next);
  return next;
}

export function addBlankSouvenoteGifts(count = 1): number {
  return writeBlankSouvenoteGiftCount(readBlankSouvenoteGiftCount() + normalizeGiftCount(count));
}

export function consumeBlankSouvenoteGift(): number {
  return writeBlankSouvenoteGiftCount(Math.max(0, readBlankSouvenoteGiftCount() - 1));
}

export function useBlankSouvenoteGiftCount(): number {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const sync = () => setCount(readBlankSouvenoteGiftCount());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(BLANK_SOUVENOTE_GIFT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(BLANK_SOUVENOTE_GIFT_EVENT, sync);
    };
  }, []);

  return count;
}
