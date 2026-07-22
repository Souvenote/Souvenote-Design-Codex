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
  .filter(Boolean);

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
});
