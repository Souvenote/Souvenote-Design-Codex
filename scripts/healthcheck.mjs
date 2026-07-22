import process from 'node:process';
import { readinessTargets } from './lib/local-runtime.mjs';
import { waitForReadiness } from './lib/health.mjs';

const parseTimeout = () => {
  const timeoutIndex = process.argv.indexOf('--timeout-ms');
  if (timeoutIndex === -1) {
    return 120_000;
  }

  const timeout = Number(process.argv.at(timeoutIndex + 1));
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error('--timeout-ms must be followed by a positive integer.');
  }

  return timeout;
};

const main = async () => {
  await waitForReadiness({ timeoutMilliseconds: parseTimeout() });
  console.log('All local readiness checks passed:');
  for (const target of readinessTargets) {
    console.log(`  ${target.name}: ${target.url}`);
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Readiness checks failed.');
  process.exitCode = 1;
});
