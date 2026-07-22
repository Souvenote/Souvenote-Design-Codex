'use client';

import * as React from 'react';
import { fetchCreditBalance, type CreditBalance } from './api';
import { AUTH_SESSION_UPDATED_EVENT } from './cognitoAuth';

export type CreditBalanceStatus = 'idle' | 'loading' | 'ready' | 'error';
type UseCreditBalanceOptions = { enabled?: boolean; fallbackBalance?: number };
type CreditBalanceEvent = CustomEvent<CreditBalance>;

const CREDIT_BALANCE_EVENT = 'souv-credit-balance';
let cachedCreditBalance: CreditBalance | null = null;

function normalizeBalance(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.floor(next) : fallback;
}

function isCreditBalance(value: unknown): value is CreditBalance {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<CreditBalance>).balance === 'number');
}

export function publishCreditBalance(balance: CreditBalance) {
  cachedCreditBalance = { balance: normalizeBalance(balance.balance) };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CreditBalance>(CREDIT_BALANCE_EVENT, { detail: cachedCreditBalance }));
  }
}

export function publishCreditBalanceValue(balance: number) {
  publishCreditBalance({ balance });
}

export function useCreditBalance({ enabled = true, fallbackBalance = 0 }: UseCreditBalanceOptions = {}) {
  const [balance, setBalance] = React.useState(() => cachedCreditBalance?.balance ?? normalizeBalance(fallbackBalance));
  const [status, setStatus] = React.useState<CreditBalanceStatus>(() => (cachedCreditBalance ? 'ready' : 'idle'));
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) {
      setStatus('idle');
      setError(null);
      setBalance(normalizeBalance(fallbackBalance));
      return null;
    }
    setStatus(cachedCreditBalance ? 'ready' : 'loading');
    try {
      const next = await fetchCreditBalance();
      publishCreditBalance(next);
      return next;
    } catch (unknownError) {
      setStatus('error');
      setError(unknownError instanceof Error ? unknownError.message : 'Credit balance is unavailable.');
      setBalance(normalizeBalance(fallbackBalance));
      return null;
    }
  }, [enabled, fallbackBalance]);

  React.useEffect(() => {
    const onBalance = (event: Event) => {
      const detail = (event as CreditBalanceEvent).detail;
      if (!isCreditBalance(detail)) return;
      setBalance(normalizeBalance(detail.balance));
      setStatus('ready');
      setError(null);
    };
    const onSession = () => {
      cachedCreditBalance = null;
      setBalance(normalizeBalance(fallbackBalance));
      setStatus('idle');
      setError(null);
    };
    window.addEventListener(CREDIT_BALANCE_EVENT, onBalance);
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onSession);
    return () => {
      window.removeEventListener(CREDIT_BALANCE_EVENT, onBalance);
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onSession);
    };
  }, [fallbackBalance]);

  React.useEffect(() => {
    let active = true;
    if (!enabled) {
      setStatus('idle');
      setBalance(normalizeBalance(fallbackBalance));
      return () => {
        active = false;
      };
    }
    if (cachedCreditBalance) {
      setBalance(cachedCreditBalance.balance);
      setStatus('ready');
    } else {
      setStatus('loading');
    }
    fetchCreditBalance()
      .then((next) => {
        if (active) publishCreditBalance(next);
      })
      .catch((unknownError) => {
        if (!active) return;
        setStatus('error');
        setError(unknownError instanceof Error ? unknownError.message : 'Credit balance is unavailable.');
        setBalance(normalizeBalance(fallbackBalance));
      });
    return () => {
      active = false;
    };
  }, [enabled, fallbackBalance]);

  return { balance, status, error, refresh };
}
