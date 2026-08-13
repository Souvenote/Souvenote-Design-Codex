"use client";

import * as React from "react";
import { fetchCardEntitlementBalance } from "./api";
import type { CardEntitlementBalance } from "./api";
import { AUTH_SESSION_UPDATED_EVENT, getStoredLocalUser } from "./cognitoAuth";

export type CardEntitlementBalanceStatus = "idle" | "loading" | "ready" | "error";

type UseCardEntitlementBalanceOptions = {
  enabled?: boolean;
  fallbackBalance?: number;
  userId?: string;
};

type CardEntitlementBalanceEvent = CustomEvent<CardEntitlementBalance>;

const CARD_ENTITLEMENT_BALANCE_EVENT = "souv-card-entitlement-balance";
let cachedCardEntitlementBalance: CardEntitlementBalance | null = null;

function normalizeBalance(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function isCardEntitlementBalance(value: unknown): value is CardEntitlementBalance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CardEntitlementBalance>;
  return typeof candidate.userId === "string"
    && typeof candidate.balance === "number"
    && Number.isFinite(candidate.balance)
    && candidate.balance >= 0;
}

function resolveUserId(userId?: string) {
  return userId || getStoredLocalUser()?.id || "";
}

export function publishCardEntitlementBalance(balance: CardEntitlementBalance) {
  cachedCardEntitlementBalance = {
    userId: balance.userId,
    balance: normalizeBalance(balance.balance),
  };
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CardEntitlementBalance>(CARD_ENTITLEMENT_BALANCE_EVENT, {
    detail: cachedCardEntitlementBalance,
  }));
}

export function useCardEntitlementBalance({
  enabled = true,
  fallbackBalance = 0,
  userId,
}: UseCardEntitlementBalanceOptions = {}) {
  const [resolvedUserId, setResolvedUserId] = React.useState(() => resolveUserId(userId));
  const initialCached = cachedCardEntitlementBalance?.userId === resolvedUserId
    ? cachedCardEntitlementBalance.balance
    : null;
  const [balance, setBalance] = React.useState(() => initialCached ?? normalizeBalance(fallbackBalance));
  const [status, setStatus] = React.useState<CardEntitlementBalanceStatus>(() => initialCached == null ? "idle" : "ready");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setResolvedUserId(resolveUserId(userId));
  }, [userId]);

  React.useEffect(() => {
    if (userId) return;

    function onAuthSessionUpdated() {
      if (!getStoredLocalUser()) {
        cachedCardEntitlementBalance = null;
        setBalance(normalizeBalance(fallbackBalance));
        setStatus("idle");
        setError(null);
      }
      setResolvedUserId(resolveUserId());
    }

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthSessionUpdated);
    return () => window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onAuthSessionUpdated);
  }, [fallbackBalance, userId]);

  const refresh = React.useCallback(async () => {
    if (!enabled || !resolvedUserId) {
      setBalance(normalizeBalance(fallbackBalance));
      setStatus("idle");
      setError(null);
      return null;
    }

    setStatus(cachedCardEntitlementBalance?.userId === resolvedUserId ? "ready" : "loading");
    setError(null);
    try {
      const next = await fetchCardEntitlementBalance();
      publishCardEntitlementBalance(next);
      return next;
    } catch (unknownError) {
      setBalance(normalizeBalance(fallbackBalance));
      setStatus("error");
      setError(unknownError instanceof Error ? unknownError.message : "Card balance is unavailable.");
      return null;
    }
  }, [enabled, fallbackBalance, resolvedUserId]);

  React.useEffect(() => {
    function onBalance(event: Event) {
      const detail = (event as CardEntitlementBalanceEvent).detail;
      if (!isCardEntitlementBalance(detail) || detail.userId !== resolvedUserId) return;
      setBalance(normalizeBalance(detail.balance));
      setStatus("ready");
      setError(null);
    }

    window.addEventListener(CARD_ENTITLEMENT_BALANCE_EVENT, onBalance);
    return () => window.removeEventListener(CARD_ENTITLEMENT_BALANCE_EVENT, onBalance);
  }, [resolvedUserId]);

  React.useEffect(() => {
    let active = true;
    if (!enabled || !resolvedUserId) {
      setBalance(normalizeBalance(fallbackBalance));
      setStatus("idle");
      setError(null);
      return () => { active = false; };
    }

    const cached = cachedCardEntitlementBalance?.userId === resolvedUserId
      ? cachedCardEntitlementBalance
      : null;
    if (cached) {
      setBalance(normalizeBalance(cached.balance));
      setStatus("ready");
      setError(null);
    } else {
      setStatus("loading");
      setError(null);
    }

    fetchCardEntitlementBalance()
      .then((next) => {
        if (active) publishCardEntitlementBalance(next);
      })
      .catch((unknownError) => {
        if (!active) return;
        setBalance(normalizeBalance(fallbackBalance));
        setStatus("error");
        setError(unknownError instanceof Error ? unknownError.message : "Card balance is unavailable.");
      });

    return () => { active = false; };
  }, [enabled, fallbackBalance, resolvedUserId]);

  return { balance, status, error, userId: resolvedUserId, refresh };
}
