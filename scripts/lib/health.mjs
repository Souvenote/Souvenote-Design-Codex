import { readinessTargets } from './local-runtime.mjs';

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const checkTarget = async (target) => {
  try {
    const response = await fetch(target.url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      return false;
    }

    if (!target.json) {
      return true;
    }

    const body = await response.json();
    return body !== null && typeof body === 'object' && body.status === 'ok';
  } catch {
    return false;
  }
};

export const getReadinessSnapshot = async (targets = readinessTargets) => {
  const results = await Promise.all(targets.map(async (target) => [target.name, await checkTarget(target)]));

  return Object.fromEntries(results);
};

export const waitForReadiness = async ({
  abortReason = () => undefined,
  intervalMilliseconds = 1_000,
  targets = readinessTargets,
  timeoutMilliseconds = 120_000,
} = {}) => {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    const reason = abortReason();
    if (reason) {
      throw new Error(reason);
    }

    const snapshot = await getReadinessSnapshot(targets);
    if (Object.values(snapshot).every(Boolean)) {
      return snapshot;
    }

    await delay(intervalMilliseconds);
  }

  const finalSnapshot = await getReadinessSnapshot(targets);
  const unavailable = Object.entries(finalSnapshot)
    .filter(([, ready]) => !ready)
    .map(([name]) => name)
    .join(', ');

  throw new Error(`Local readiness timed out. Unavailable: ${unavailable || 'unknown'}.`);
};
