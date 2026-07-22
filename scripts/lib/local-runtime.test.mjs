import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createSafeLocalEnvironment, workspaceEnvironment } from './local-runtime.mjs';

test('local runtime overrides unsafe modes and neutralizes provider credentials', () => {
  const environment = createSafeLocalEnvironment({
    AUTH_MODE: 'cognito',
    AWS_ACCESS_KEY_ID: 'must-not-reach-child',
    FAL_KEY: 'must-not-reach-child',
    IMAGE_PROVIDER_MODE: 'live',
    NEXT_PUBLIC_COGNITO_CLIENT_ID: 'must-not-reach-child',
    PATH: 'inherited-path',
    STRIPE_SECRET_KEY: 'must-not-reach-child',
  });

  assert.equal(environment.AUTH_MODE, 'local');
  assert.equal(environment.DATABASE_SSL_MODE, 'disable');
  assert.equal(environment.AWS_ACCESS_KEY_ID, '');
  assert.equal(environment.FAL_KEY, '');
  assert.equal(environment.IMAGE_PROVIDER_MODE, 'mock');
  assert.equal(environment.PAYMENT_PROVIDER_MODE, 'mock');
  assert.equal(environment.NEXT_PUBLIC_COGNITO_CLIENT_ID, '');
  assert.equal(environment.PATH, 'inherited-path');
  assert.equal(environment.STRIPE_SECRET_KEY, '');
  assert.match(environment.DATABASE_URL, /^postgresql:\/\/souvenote:/);
});

test('local runtime defines every provider category as mock or disabled', () => {
  const environment = createSafeLocalEnvironment({});
  const modes = [
    environment.IMAGE_PROVIDER_MODE,
    environment.MUSIC_PROVIDER_MODE,
    environment.TEXT_PROVIDER_MODE,
    environment.PAYMENT_PROVIDER_MODE,
    environment.FULFILLMENT_PROVIDER_MODE,
    environment.NOTIFICATION_PROVIDER_MODE,
    environment.EMAIL_PROVIDER_MODE,
    environment.ANALYTICS_MODE,
    environment.ERROR_REPORTING_MODE,
  ];

  assert.ok(modes.every((mode) => mode === 'mock' || mode === 'disabled'));
});

test('worker keeps its explicit disabled auth boundary while web and API use local auth', () => {
  const environment = createSafeLocalEnvironment({});

  assert.equal(workspaceEnvironment('@souvenote/web', environment).AUTH_MODE, 'local');
  assert.equal(workspaceEnvironment('@souvenote/api', environment).AUTH_MODE, 'local');
  assert.equal(workspaceEnvironment('@souvenote/worker', environment).AUTH_MODE, 'disabled');
});

test('PostgreSQL port override is shared by Compose and DATABASE_URL', () => {
  const moduleUrl = new URL('./local-runtime.mjs', import.meta.url).href;
  const evaluation = [
    `import { createSafeLocalEnvironment } from ${JSON.stringify(moduleUrl)};`,
    'const environment = createSafeLocalEnvironment();',
    'process.stdout.write(JSON.stringify({',
    '  databaseUrl: environment.DATABASE_URL,',
    '  postgresHostPort: environment.POSTGRES_HOST_PORT,',
    '}));',
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', evaluation], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SOUVENOTE_POSTGRES_PORT: '55555',
    },
  });

  assert.equal(result.status, 0, result.stderr);
  const environment = JSON.parse(result.stdout);
  assert.equal(environment.postgresHostPort, '55555');
  assert.match(environment.databaseUrl, /127\.0\.0\.1:55555\/souvenote$/);
});
