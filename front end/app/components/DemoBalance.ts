"use client";

import * as React from "react";
import type { DemoCredits } from "./DemoUser";

export type DemoBalance = {
  credits: DemoCredits;
  cardBank: number;
};

type DemoBalanceInput = {
  credits?: Partial<Record<keyof DemoCredits, unknown>> | null;
  cardBank?: unknown;
} | null | undefined;

type DemoBalanceDelta = {
  credits?: unknown;
  cards?: unknown;
};

type CartTopUpItem = {
  type?: unknown;
  qty?: unknown;
  meta?: unknown;
  name?: unknown;
  tokens?: unknown;
  cardCount?: unknown;
  creditsPerCard?: unknown;
  cards?: unknown;
};

export type CartTopUpDelta = {
  credits: number;
  cards: number;
};

declare global {
  interface Window {
    __souvSetDemoBalance?: (next: DemoBalanceInput) => void;
    __souvZeroDemoBalance?: () => void;
    __souvClearDemoBalance?: () => void;
  }
}

export const DEMO_BALANCE_STORAGE_KEY = "souv_demo_balance";
export const ZERO_DEMO_BALANCE: DemoBalance = {
  credits: { images: 0, songs: 0 },
  cardBank: 0,
};
export const DEFAULT_DEMO_BALANCE: DemoBalance = ZERO_DEMO_BALANCE;

function normalizeNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function normalizeOptionalNumber(value: string | null, fallback = 0): number {
  return value === null ? fallback : normalizeNumber(value, fallback);
}

function saveDemoBalance(balance: DemoBalance): void {
  window.localStorage.setItem(DEMO_BALANCE_STORAGE_KEY, JSON.stringify(balance));
}

function clearDemoBalanceOverrideParams(): void {
  const url = new URL(window.location.href);
  const keys = ["demoBalance", "demoCredits", "demoImages", "demoSongs", "demoCards"];
  const hadOverride = keys.some((key) => url.searchParams.has(key));
  if (!hadOverride) return;

  keys.forEach((key) => url.searchParams.delete(key));
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function readDemoBalanceOverride(fallback: DemoBalance): DemoBalance | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("demoBalance") === "zero") return ZERO_DEMO_BALANCE;

  const creditsParam = params.get("demoCredits");
  const imagesParam = params.get("demoImages");
  const songsParam = params.get("demoSongs");
  const cardsParam = params.get("demoCards");
  if (creditsParam === null && imagesParam === null && songsParam === null && cardsParam === null) {
    return null;
  }

  const creditTotal = creditsParam !== null
    ? normalizeNumber(creditsParam, fallback.credits.images + fallback.credits.songs)
    : null;

  return normalizeDemoBalance({
    credits: {
      images: creditTotal !== null ? creditTotal : normalizeOptionalNumber(imagesParam, fallback.credits.images),
      songs: creditTotal !== null ? 0 : normalizeOptionalNumber(songsParam, fallback.credits.songs),
    },
    cardBank: normalizeOptionalNumber(cardsParam, fallback.cardBank),
  }, fallback);
}

export function normalizeDemoBalance(value: DemoBalanceInput, fallback: DemoBalance = DEFAULT_DEMO_BALANCE): DemoBalance {
  const source = value && typeof value === "object" ? value : {};
  const sourceCredits = source.credits && typeof source.credits === "object" ? source.credits : {};

  return {
    credits: {
      images: normalizeNumber(sourceCredits.images, fallback.credits.images),
      songs: normalizeNumber(sourceCredits.songs, fallback.credits.songs),
    },
    cardBank: normalizeNumber(source.cardBank, fallback.cardBank),
  };
}

export function getTotalDemoCredits(balance: DemoBalanceInput): number {
  return normalizeNumber(balance?.credits?.images) + normalizeNumber(balance?.credits?.songs);
}

export function readDemoBalance(fallback: DemoBalance = DEFAULT_DEMO_BALANCE): DemoBalance {
  if (typeof window === "undefined") return fallback;

  try {
    const override = readDemoBalanceOverride(fallback);
    if (override) {
      saveDemoBalance(override);
      clearDemoBalanceOverrideParams();
      return override;
    }

    const raw = window.localStorage.getItem(DEMO_BALANCE_STORAGE_KEY);
    return raw ? normalizeDemoBalance(JSON.parse(raw), fallback) : fallback;
  } catch {
    return fallback;
  }
}

export function writeDemoBalance(balance: DemoBalanceInput): void {
  if (typeof window === "undefined") return;

  const next = normalizeDemoBalance(balance);
  saveDemoBalance(next);
  window.dispatchEvent(new CustomEvent("souv-demo-balance", { detail: next }));
}

function parseFirstNumber(value: unknown): number {
  const match = String(value || "").match(/\d+/);
  return match ? normalizeNumber(match[0], 0) : 0;
}

export function addDemoBalance(delta: DemoBalanceDelta): DemoBalance {
  if (typeof window === "undefined") return DEFAULT_DEMO_BALANCE;

  const current = readDemoBalance();
  const next = normalizeDemoBalance({
    credits: {
      images: normalizeNumber(current.credits.images) + normalizeNumber(delta?.credits),
      songs: normalizeNumber(current.credits.songs),
    },
    cardBank: normalizeNumber(current.cardBank) + normalizeNumber(delta?.cards),
  });
  writeDemoBalance(next);
  return next;
}

export function getCartTopUpDelta(items: unknown): CartTopUpDelta {
  if (!Array.isArray(items) || items.length === 0) return { credits: 0, cards: 0 };

  return (items as CartTopUpItem[]).reduce<CartTopUpDelta>((sum, item) => {
    const qty = Math.max(1, Math.floor(Number(item?.qty) || 1));

    if (item?.type === "credits") {
      return {
        credits: sum.credits + parseFirstNumber(item.tokens || item.meta || item.name) * qty,
        cards: sum.cards,
      };
    }

    if (item?.type === "pack") {
      const cards = normalizeNumber(item.cardCount, parseFirstNumber(item.meta || item.cards || item.name)) * qty;
      const creditsPerCard = normalizeNumber(item.creditsPerCard, 10);
      return {
        credits: sum.credits + (cards * creditsPerCard),
        cards: sum.cards + cards,
      };
    }

    return sum;
  }, { credits: 0, cards: 0 });
}

export function spendDemoCredits(amount: unknown): DemoBalance {
  if (typeof window === "undefined") return DEFAULT_DEMO_BALANCE;

  const current = readDemoBalance();
  let remainingSpend = normalizeNumber(amount);
  const imageCredits = normalizeNumber(current.credits.images);
  const songCredits = normalizeNumber(current.credits.songs);
  const imagesSpent = Math.min(imageCredits, remainingSpend);
  remainingSpend -= imagesSpent;
  const songsSpent = Math.min(songCredits, remainingSpend);

  const next = normalizeDemoBalance({
    credits: {
      images: imageCredits - imagesSpent,
      songs: songCredits - songsSpent,
    },
    cardBank: current.cardBank,
  });
  writeDemoBalance(next);
  return next;
}

export function applyDemoTopUpFromCart(items: unknown): DemoBalance {
  if (!Array.isArray(items) || items.length === 0) return readDemoBalance();

  return addDemoBalance(getCartTopUpDelta(items));
}

export function clearDemoBalance(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(DEMO_BALANCE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("souv-demo-balance", { detail: null }));
}

export function useDemoBalance(fallback: DemoBalance = DEFAULT_DEMO_BALANCE): DemoBalance {
  const [balance, setBalance] = React.useState<DemoBalance>(fallback);

  React.useEffect(() => {
    const sync = () => setBalance(readDemoBalance(fallback));

    window.__souvSetDemoBalance = (next) => writeDemoBalance(next);
    window.__souvZeroDemoBalance = () => writeDemoBalance(ZERO_DEMO_BALANCE);
    window.__souvClearDemoBalance = clearDemoBalance;

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("souv-demo-balance", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("souv-demo-balance", sync);
    };
  }, [fallback]);

  return balance;
}
