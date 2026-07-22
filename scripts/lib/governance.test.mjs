import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repositoryRoot } from './local-runtime.mjs';

const readRepositoryFile = (relativePath) => readFile(path.join(repositoryRoot, relativePath), 'utf8');

test('all task entry points require the complete build plan', async () => {
  const [agents, readme, decisions] = await Promise.all([
    readRepositoryFile('AGENTS.md'),
    readRepositoryFile('README.md'),
    readRepositoryFile('docs/product/decision-register.md'),
  ]);

  assert.match(agents, /docs\/engineering\/build-plan\.md/);
  assert.match(agents, /C:\\Users\\wilso\\Desktop\\Souvenote_Design_Codex/);
  assert.match(readme, /docs\/engineering\/build-plan\.md/);
  assert.match(decisions, /MVP-020 - Complete build plan is mandatory/);
});

test('build plan preserves every section, gate, workflow, and completion contract', async () => {
  const buildPlan = await readRepositoryFile('docs/engineering/build-plan.md');
  const sectionNumbers = [...buildPlan.matchAll(/^## Section (\d) -/gm)].map((match) => Number(match[1]));

  assert.deepEqual(sectionNumbers, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(buildPlan, /^## Mandatory task workflow$/m);
  assert.match(buildPlan, /Use one fresh Codex task per PR-sized section/);
  assert.match(buildPlan, /no more than three non-overlapping workers/);
  assert.match(buildPlan, /Every cost-increasing AWS mutation/);
  assert.match(buildPlan, /Silence is never approval/);
  assert.equal((buildPlan.match(/^Gate:/gm) ?? []).length, 9);
  assert.match(buildPlan, /^## MVP completion contract$/m);
  assert.match(buildPlan, /Raw card data never enters Souvenote/);
  assert.match(buildPlan, /Critical tests, builds, audits, migrations, staging smoke tests/);
});
