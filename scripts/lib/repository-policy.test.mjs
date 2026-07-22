import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { repositoryRoot } from './local-runtime.mjs';

const trackedFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && existsSync(path.join(repositoryRoot, file)));

const governedTextExtension = new Set(['.css', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml']);
const excludedTextPrefixes = ['apps/web/app/styles/', 'apps/web/public/', 'database/', 'docs/legacy/'];

test('repository has one workspace lockfile and no tracked local secrets', () => {
  const lockfiles = trackedFiles.filter((file) => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file));
  assert.deepEqual(lockfiles, ['package-lock.json']);

  const unsafeEnvironmentFiles = trackedFiles.filter(
    (file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example'),
  );
  assert.deepEqual(unsafeEnvironmentFiles, []);

  assert.equal(existsSync(path.join(repositoryRoot, 'front end')), false);
  assert.equal(existsSync(path.join(repositoryRoot, 'backend', 'server')), false);

  const rootPackage = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.equal(rootPackage.scripts.prepare, 'npm run build --workspace=@souvenote/contracts');
});

test('governed text has no trailing whitespace or obvious committed credentials', () => {
  const findings = [];
  const secretPattern = /(AKIA[0-9A-Z]{16}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|sk_live_|whsec_)/;

  for (const relativePath of trackedFiles) {
    if (!governedTextExtension.has(path.extname(relativePath))) continue;
    if (excludedTextPrefixes.some((prefix) => relativePath.startsWith(prefix))) continue;

    const contents = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    const lines = contents.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/[\t ]+$/.test(line)) findings.push(`${relativePath}:${index + 1}: trailing whitespace`);
    });
    if (relativePath !== 'scripts/lib/repository-policy.test.mjs' && secretPattern.test(contents)) {
      findings.push(`${relativePath}: possible committed credential`);
    }
  }

  assert.deepEqual(findings, []);
});

test('GitHub Actions dependencies are pinned to exact commit SHAs', () => {
  const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
  const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);

  assert.notEqual(actionReferences.length, 0);
  actionReferences.forEach((reference) => assert.match(reference, /@[0-9a-f]{40}$/));

  const imagePull = workflow.indexOf('run: docker pull postgres:16-alpine');
  const databaseVerification = workflow.indexOf('run: npm run test:database');
  assert.ok(imagePull > 0, 'CI must pull the pinned PostgreSQL image explicitly');
  assert.ok(imagePull < databaseVerification, 'CI must pull PostgreSQL before database verification');
});

test('API persistence and route authority boundaries remain fail closed', () => {
  const apiSource = trackedFiles.filter((file) => file.startsWith('apps/api/src/') && file.endsWith('.ts'));
  const findings = [];

  for (const relativePath of apiSource) {
    const contents = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    if (
      contents.includes("from '../database/database.service'") &&
      !relativePath.endsWith('.spec.ts') &&
      !relativePath.endsWith('.repository.ts') &&
      !relativePath.includes('/database/') &&
      relativePath !== 'apps/api/src/health/health.controller.ts'
    ) {
      findings.push(`${relativePath}: DatabaseService imported outside a repository`);
    }
    if (
      (relativePath.endsWith('.controller.ts') || relativePath.endsWith('.service.ts')) &&
      /`\s*(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(contents)
    ) {
      findings.push(`${relativePath}: SQL found outside a repository`);
    }
    if (
      relativePath.endsWith('.controller.ts') &&
      !contents.includes('@ApiBearerAuth()') &&
      !contents.includes('@Public()')
    ) {
      findings.push(`${relativePath}: controller is neither authenticated nor explicitly public`);
    }
    if (relativePath.endsWith('.controller.ts') && /\buserId\??\s*[!:]/.test(contents)) {
      findings.push(`${relativePath}: customer controller accepts caller-supplied userId`);
    }
  }

  assert.deepEqual(findings, []);
});

test('browser code contains no token authority, hardcoded customer identity, or direct Cognito SDK', () => {
  const browserFiles = trackedFiles.filter(
    (file) => file.startsWith('apps/web/app/') && /\.(?:ts|tsx)$/.test(file) && !file.endsWith('.spec.ts'),
  );
  const forbidden = [
    ['amazon-cognito-identity-js', /amazon-cognito-identity-js/],
    ['local mock user authority', /LOCAL_MOCK_USER_ID/],
    ['public API base URL', /NEXT_PUBLIC_API/],
    [
      'browser token persistence',
      /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^\n]*(?:token|access|refresh)/i,
    ],
  ];
  const findings = [];
  for (const relativePath of browserFiles) {
    const contents = readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
    for (const [label, pattern] of forbidden) {
      if (pattern.test(contents)) findings.push(`${relativePath}: ${label}`);
    }
  }
  assert.deepEqual(findings, []);
});

test('application source never accepts raw payment-card fields', () => {
  const applicationFiles = trackedFiles.filter(
    (file) =>
      (file.startsWith('apps/api/src/') || file.startsWith('apps/web/app/')) &&
      /\.(?:ts|tsx)$/.test(file) &&
      !file.endsWith('.spec.ts'),
  );
  const rawCardField = /(?:cardNumber|card_number|\bcvc\b|\bcvv\b)/i;
  const findings = applicationFiles
    .filter((relativePath) => rawCardField.test(readFileSync(path.join(repositoryRoot, relativePath), 'utf8')))
    .map((relativePath) => `${relativePath}: raw payment-card field`);

  assert.deepEqual(findings, []);
});
