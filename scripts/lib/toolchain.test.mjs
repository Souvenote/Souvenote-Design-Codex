import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCanonicalToolchain, canonicalToolchain } from './toolchain.mjs';

test('canonical toolchain accepts Node.js 22 and npm 10.9.8', () => {
  assert.deepEqual(assertCanonicalToolchain({ nodeVersion: '22.22.0', npmVersion: '10.9.8' }), {
    nodeVersion: '22.22.0',
    npmVersion: '10.9.8',
  });
  assert.deepEqual(canonicalToolchain, { nodeMajor: 22, npmVersion: '10.9.8' });
});

test('canonical toolchain rejects another Node.js major', () => {
  assert.throws(
    () => assertCanonicalToolchain({ nodeVersion: '24.16.0', npmVersion: '10.9.8' }),
    /requires Node\.js 22/,
  );
});

test('canonical toolchain rejects an unpinned npm version', () => {
  assert.throws(
    () => assertCanonicalToolchain({ nodeVersion: '22.22.0', npmVersion: '11.13.0' }),
    /requires npm 10\.9\.8/,
  );
});
