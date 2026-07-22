import { execFileSync } from 'node:child_process';

const NODE_MAJOR = 22;
const NPM_VERSION = '10.9.8';

const readInvokingNpmVersion = () => {
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) return undefined;

  try {
    return execFileSync(process.execPath, [npmExecPath, '--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
};

export const assertCanonicalToolchain = ({
  nodeVersion = process.versions.node,
  npmVersion = readInvokingNpmVersion(),
} = {}) => {
  const nodeMajor = Number(nodeVersion.split('.')[0]);
  if (nodeMajor !== NODE_MAJOR) {
    throw new Error(`Souvenote requires Node.js 22; current runtime is ${nodeVersion}.`);
  }

  if (npmVersion !== NPM_VERSION) {
    throw new Error(
      `Souvenote requires npm ${NPM_VERSION}; current npm is ${npmVersion ?? 'unknown'}. Run through the pinned npm toolchain.`,
    );
  }

  return Object.freeze({ nodeVersion, npmVersion });
};

export const canonicalToolchain = Object.freeze({
  nodeMajor: NODE_MAJOR,
  npmVersion: NPM_VERSION,
});
