"use client";

import * as React from "react";
import { fetchCreditBalance } from "./api";
import type { CreditBalance } from "./api";
import { AUTH_SESSION_UPDATED_EVENT, getStoredLocalUser } from "./cognitoAuth";

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

function resolveCreditUserId(userId?: string) {
  return userId || getStoredLocalUser()?.id || "";
}

export function publishCreditBalance(balance: CreditBalance) {
  cachedCreditBalance = {
    userId: balance.userId,
    balance: normalizeBalance(balance.balance),
  };

  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CreditBalance>(CREDIT_BALANCE_EVENT, { detail: cachedCreditBalance }));
}

export function useCreditBalance({
  enabled = true,
  fallbackBalance = 0,
  userId,
}: UseCreditBalanceOptions = {}) {
  const [resolvedUserId, setResolvedUserId] = React.useState(() => resolveCreditUserId(userId));
  const initialCached = cachedCreditBalance?.userId === resolvedUserId ? cachedCreditBalance.balance : null;
  const [balance, setBalance] = React.useState(() => initialCached ?? normalizeBalance(fallbackBalance));
  const [status, setStatus] = React.useState<CreditBalanceStatus>(() => initialCached == null ? "idle" : "ready");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setResolvedUserId(resolveCreditUserId(userId));
  }, [userId]);

  React.useEffect(() => {
    if (userId) return;

    function onAuthSessionUpdated() {
      if (!getStoredLocalUser()) {
        cachedCreditBalance = null;
        setBalance(normalizeBalance(fallbackBalance));
        setStatus("idle");
        setError(null);
      }

      setResolvedUserId(resolveCreditUserId());
    }

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthSessionUpdated);
    return () => window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthSessionUpdated);
  }, [fallbackBalance, userId]);

  const refresh = React.useCallback(async () => {
    if (!enabled || !resolvedUserId) {
      setStatus("idle");
      setError(null);
      setBalance(normalizeBalance(fallbackBalance));
      return null;
    }

    setStatus(cachedCreditBalance?.userId === resolvedUserId ? "ready" : "loading");
    setError(null);

    try {
      const next = await fetchCreditBalance();
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
  }, [enabled, fallbackBalance, resolvedUserId]);

  React.useEffect(() => {
    function onCreditBalance(event: Event) {
      const detail = (event as CreditBalanceEvent).detail;
      if (!isCreditBalance(detail) || detail.userId !== resolvedUserId) return;
      setBalance(normalizeBalance(detail.balance));
      setStatus("ready");
      setError(null);
    }

    window.addEventListener(CREDIT_BALANCE_EVENT, onCreditBalance);
    return () => window.removeEventListener(CREDIT_BALANCE_EVENT, onCreditBalance);
  }, [resolvedUserId]);

  React.useEffect(() => {
    let active = true;

    if (!enabled || !resolvedUserId) {
      setStatus("idle");
      setError(null);
      setBalance(normalizeBalance(fallbackBalance));
      return () => {
        active = false;
      };
    }

    const cached = cachedCreditBalance?.userId === resolvedUserId ? cachedCreditBalance : null;
    if (cached) {
      setBalance(normalizeBalance(cached.balance));
      setStatus("ready");
      setError(null);
    } else {
      setStatus("loading");
      setError(null);
    }

    fetchCreditBalance()
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
  }, [enabled, fallbackBalance, resolvedUserId]);

  return {
    balance,
    status,
    error,
    userId: resolvedUserId,
    refresh,
  };
}
