import { assertCanonicalToolchain } from './lib/toolchain.mjs';

try {
  const toolchain = assertCanonicalToolchain();
  console.log(`Canonical toolchain active: Node.js ${toolchain.nodeVersion}, npm ${toolchain.npmVersion}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The canonical toolchain check failed.');
  process.exitCode = 1;
}
