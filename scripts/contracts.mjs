import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const checkOnly = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('contracts.mjs accepts only --check.');
}

const repository = process.cwd();
const snapshot = path.join(repository, 'packages', 'contracts', 'openapi.json');
const generated = path.join(repository, 'packages', 'contracts', 'src', 'generated', 'openapi.ts');
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'souvenote-contracts-'));
const temporarySnapshot = path.join(temporaryDirectory, 'openapi.json');
const temporaryGenerated = path.join(temporaryDirectory, 'openapi.ts');

function run(command, arguments_, environment = process.env) {
  const result = spawnSync(command, arguments_, {
    cwd: repository,
    env: environment,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n') || `${command} failed.`,
    );
  }
}

async function equal(left, right) {
  try {
    return (await readFile(left, 'utf8')) === (await readFile(right, 'utf8'));
  } catch {
    return false;
  }
}

try {
  const npmExecutable = process.env.npm_execpath;
  if (!npmExecutable) throw new Error('npm_execpath is required to generate contracts deterministically.');
  run(process.execPath, [npmExecutable, 'run', 'openapi:generate', '--workspace=@souvenote/api'], {
    ...process.env,
    OPENAPI_OUTPUT: temporarySnapshot,
  });
  const repositoryRequire = createRequire(path.join(repository, 'package.json'));
  const openapiTypescript = repositoryRequire('openapi-typescript');
  const contractSource = await openapiTypescript(JSON.parse(await readFile(temporarySnapshot, 'utf8')));
  await writeFile(temporaryGenerated, contractSource, 'utf8');
  const prettier = path.join(repository, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
  const prettierConfig = path.join(repository, 'prettier.config.mjs');
  run(process.execPath, [prettier, '--config', prettierConfig, '--write', temporarySnapshot, temporaryGenerated]);

  if (checkOnly) {
    const snapshotMatches = await equal(snapshot, temporarySnapshot);
    const generatedMatches = await equal(generated, temporaryGenerated);
    if (!snapshotMatches || !generatedMatches) {
      throw new Error('Generated API contracts have drifted. Run npm run contracts:generate and commit the result.');
    }
    process.stdout.write('generated API contracts are current\n');
  } else {
    await mkdir(path.dirname(generated), { recursive: true });
    await writeFile(snapshot, await readFile(temporarySnapshot));
    await writeFile(generated, await readFile(temporaryGenerated));
    process.stdout.write('generated API contracts updated\n');
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
