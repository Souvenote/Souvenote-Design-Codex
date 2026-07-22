import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationRunner = path.join(databaseDirectory, 'migrate.mjs');
const contractTest = path.join(
  databaseDirectory,
  'tests',
  '0001_mvp_baseline.test.sql',
);
const imageTag = 'postgres:16-alpine';
const containerName = `souvenote-db-verify-${randomBytes(6).toString('hex')}`;
const databaseName = 'souvenote_verify';
const databaseUser = 'souvenote_verify';
const databasePassword = randomBytes(24).toString('hex');

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });

  if (!options.allowFailure && result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} failed${output ? `:\n${output}` : ''}`);
  }
  return result;
}

function ensureSafeContainerName() {
  if (!/^souvenote-db-verify-[0-9a-f]{12}$/u.test(containerName)) {
    throw new Error('refusing to operate on an unexpected container name');
  }
}

function resolveLocalImage() {
  const direct = run('docker', ['image', 'inspect', imageTag], { allowFailure: true });
  if (direct.status === 0) return imageTag;

  // Docker Desktop's containerd image store can list a tagged image while an
  // inspect-by-tag call briefly fails. Resolve the immutable local image ID as
  // a bounded fallback; never pull implicitly from this verification script.
  const listed = run('docker', ['image', 'ls', '--quiet', '--no-trunc', imageTag], { allowFailure: true });
  const imageId = listed.stdout.trim().split(/\r?\n/u).find(Boolean);
  if (!imageId || !/^sha256:[0-9a-f]{64}$/u.test(imageId)) {
    throw new Error(`local ${imageTag} image is required; run docker pull ${imageTag}`);
  }
  run('docker', ['image', 'inspect', imageId]);
  return imageId;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = run(
      'docker',
      [
        'exec',
        containerName,
        'pg_isready',
        '-U',
        databaseUser,
        '-d',
        databaseName,
      ],
      { allowFailure: true },
    );
    if (result.status === 0) {
      const query = run(
        'docker',
        ['exec', containerName, 'psql', '--username', databaseUser, '--dbname', databaseName, '--command', 'SELECT 1;'],
        { allowFailure: true },
      );
      if (query.status === 0) return;
    }
    await wait(500);
  }
  throw new Error('disposable PostgreSQL did not become ready within 60 seconds');
}

function connectionUrl() {
  const portResult = run('docker', ['port', containerName, '5432/tcp']);
  const match = portResult.stdout.trim().match(/:(\d+)$/u);
  if (!match) {
    throw new Error('could not resolve the disposable PostgreSQL host port');
  }
  return `postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${match[1]}/${databaseName}`;
}

function runMigration(databaseUrl, allowFailure = false) {
  return run(process.execPath, [migrationRunner], {
    allowFailure,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

function runApiIntegration(databaseUrl) {
  const npmExecutable = process.env.npm_execpath;
  if (!npmExecutable) {
    throw new Error('run database verification through npm so the pinned npm executable is available');
  }
  run(process.execPath, [npmExecutable, 'run', 'test:e2e', '--workspace=@souvenote/api'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AUTH_MODE: 'local',
      LOCAL_AUTH_SECRET: 'souvenote-integration-local-auth-secret-32-bytes',
      LOCAL_AUTH_CLIENT_ID: 'souvenote-local-web',
      COGNITO_REQUIRED_SCOPES: 'souvenote:customer',
      CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3000',
      DATABASE_URL: databaseUrl,
      DATABASE_SSL_MODE: 'disable',
      RATE_LIMIT_MAX_REQUESTS: '10000',
      STRIPE_WEBHOOK_SECRET: 'stripe-integration-webhook-secret',
      SCRIBELESS_WEBHOOK_SECRET: 'scribeless-integration-webhook-secret',
    },
  });
}

async function main() {
  ensureSafeContainerName();
  const image = resolveLocalImage();

  try {
    run('docker', [
      'run',
      '--detach',
      '--rm',
      '--name',
      containerName,
      '--env',
      `POSTGRES_DB=${databaseName}`,
      '--env',
      `POSTGRES_USER=${databaseUser}`,
      '--env',
      `POSTGRES_PASSWORD=${databasePassword}`,
      '--publish',
      '127.0.0.1::5432',
      image,
    ]);

    await waitForPostgres();
    const databaseUrl = connectionUrl();

    run(process.execPath, [migrationRunner, '--verify-only']);
    runMigration(databaseUrl);
    const secondRun = runMigration(databaseUrl);
    if (!secondRun.stdout.includes('already applied 0001_mvp_baseline.sql')) {
      throw new Error('second migration run did not prove the baseline is idempotent');
    }

    const sql = await readFile(contractTest, 'utf8');
    run(
      'docker',
      [
        'exec',
        '--interactive',
        containerName,
        'psql',
        '--set',
        'ON_ERROR_STOP=1',
        '--username',
        databaseUser,
        '--dbname',
        databaseName,
      ],
      { input: sql },
    );

    runApiIntegration(databaseUrl);

    run('docker', [
      'exec',
      containerName,
      'psql',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      databaseUser,
      '--dbname',
      databaseName,
      '--command',
      `ALTER TABLE schema_migrations DISABLE TRIGGER schema_migrations_are_immutable;
       UPDATE schema_migrations SET checksum_sha256 = repeat('0', 64) WHERE version = '0001';
       ALTER TABLE schema_migrations ENABLE TRIGGER schema_migrations_are_immutable;`,
    ]);

    const driftRun = runMigration(databaseUrl, true);
    const driftOutput = `${driftRun.stdout}\n${driftRun.stderr}`;
    if (
      driftRun.status === 0 ||
      !driftOutput.includes('database checksum mismatch for applied migration 0001')
    ) {
      throw new Error('migration runner did not reject an altered journal checksum');
    }

    console.log('database baseline verification passed');
  } finally {
    ensureSafeContainerName();
    run('docker', ['rm', '--force', containerName], { allowFailure: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown verification failure');
  process.exitCode = 1;
});
