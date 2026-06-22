"use client";

import * as React from "react";
import { fetchCreditBalance, LOCAL_MOCK_USER_ID } from "./api";
import type { CreditBalance } from "./api";

export type CreditBalanceStatus = "idle" | "loading" | "ready" | "error";

type UseCreditBalanceOptions = {
  enabled?: boolean;
  fallbackBalance?: number;
  userId?: string;
};

type CreditBalanceEvent = CustomEvent<CreditBalance>;

const CREDIT_BALANCE_EVENT = "souv-credit-balance";

let cachedCreditBalance: CreditBalance | null = null;

function normalizeBalance(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function isCreditBalance(value: unknown): value is CreditBalance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CreditBalance>;
  return typeof candidate.userId === "string"
    && typeof candidate.balance === "number"
    && Number.isFinite(candidate.balance);
}

export function publishCreditBalance(balance: CreditBalance) {
  cachedCreditBalance = {
    userId: balance.userId,
    balance: normalizeBalance(balance.balance),
  };

  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CreditBalance>(CREDIT_BALANCE_EVENT, { detail: cachedCreditBalance }));
}

export function publishCreditBalanceValue(balance: number, userId = LOCAL_MOCK_USER_ID) {
  publishCreditBalance({ userId, balance });
}

export function useCreditBalance({
  enabled = true,
  fallbackBalance = 0,
  userId = LOCAL_MOCK_USER_ID,
}: UseCreditBalanceOptions = {}) {
  const initialCached = cachedCreditBalance?.userId === userId ? cachedCreditBalance.balance : null;
  const [balance, setBalance] = React.useState(() => initialCached ?? normalizeBalance(fallbackBalance));
  const [status, setStatus] = React.useState<CreditBalanceStatus>(() => initialCached == null ? "idle" : "ready");
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) {
      setStatus("idle");
      return null;
    }

    setStatus(cachedCreditBalance?.userId === userId ? "ready" : "loading");
    setError(null);

    try {
      const next = await fetchCreditBalance(userId);
      publishCreditBalance(next);
      return next;
    } catch (unknownError) {
      const message = unknownError instanceof Error
        ? unknownError.message
        : "Credit balance is unavailable.";
      setStatus("error");
      setError(message);
      setBalance(normalizeBalance(fallbackBalance));
      return null;
    }
  }, [enabled, fallbackBalance, userId]);

  React.useEffect(() => {
    function onCreditBalance(event: Event) {
      const detail = (event as CreditBalanceEvent).detail;
      if (!isCreditBalance(detail) || detail.userId !== userId) return;
      setBalance(normalizeBalance(detail.balance));
      setStatus("ready");
      setError(null);
    }

    window.addEventListener(CREDIT_BALANCE_EVENT, onCreditBalance);
    return () => window.removeEventListener(CREDIT_BALANCE_EVENT, onCreditBalance);
  }, [userId]);

  React.useEffect(() => {
    let active = true;

    if (!enabled) {
      setStatus("idle");
      return () => {
        active = false;
      };
    }

    const cached = cachedCreditBalance?.userId === userId ? cachedCreditBalance : null;
    if (cached) {
      setBalance(normalizeBalance(cached.balance));
      setStatus("ready");
      setError(null);
    } else {
      setStatus("loading");
      setError(null);
    }

    fetchCreditBalance(userId)
      .then((next) => {
        if (!active) return;
        publishCreditBalance(next);
      })
      .catch((unknownError) => {
        if (!active) return;
        const message = unknownError instanceof Error
          ? unknownError.message
          : "Credit balance is unavailable.";
        setStatus("error");
        setError(message);
        setBalance(normalizeBalance(fallbackBalance));
      });

    return () => {
      active = false;
    };
  }, [enabled, fallbackBalance, userId]);

  return {
    balance,
    status,
    error,
    userId,
    refresh,
  };
}
