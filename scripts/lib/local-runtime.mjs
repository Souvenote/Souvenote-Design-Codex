import { fileURLToPath } from 'node:url';
import path from 'node:path';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = path.resolve(moduleDirectory, '..', '..');
export const composeFile = path.join(repositoryRoot, 'compose.yaml');
export const defaultComposeProject = 'souvenote-local';
export const isolatedComposeProject = 'souvenote-audit';

const readPort = (name, fallback, sourceEnvironment = process.env) => {
  const rawValue = sourceEnvironment[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be an integer from 1 through 65535.`);
  }
  return value;
};

export const localPorts = Object.freeze({
  web: readPort('SOUVENOTE_WEB_PORT', 3000),
  api: readPort('SOUVENOTE_API_PORT', 4000),
  worker: readPort('SOUVENOTE_WORKER_PORT', 4001),
  postgres: readPort('SOUVENOTE_POSTGRES_PORT', 55432),
});

export const readinessTargets = Object.freeze([
  {
    name: 'web',
    url: `http://127.0.0.1:${localPorts.web}/api/health`,
    json: true,
  },
  {
    name: 'web image optimizer',
    url: `http://127.0.0.1:${localPorts.web}/_next/image?url=%2Fassets%2FLogoMark.png&w=64&q=75`,
    json: false,
    requestTimeoutMilliseconds: 15_000,
  },
  {
    name: 'api',
    url: `http://127.0.0.1:${localPorts.api}/api/v1/health/ready`,
    json: true,
  },
  {
    name: 'worker',
    url: `http://127.0.0.1:${localPorts.worker}/health/ready`,
    json: true,
  },
]);

const externalCredentialPattern =
  /^(?:(?:NEXT_PUBLIC_)?(?:APPLE_|COGNITO_|FACEBOOK_|GOOGLE_|STRIPE_)|AWS_|BEDROCK_|FAL_|OPENAI_|SCRIBELESS_|SENDGRID_|POSTHOG_|SENTRY_)/i;

const neutralizedCredentials = Object.freeze({
  AWS_ACCESS_KEY_ID: '',
  AWS_PROFILE: '',
  AWS_REGION: '',
  AWS_S3_BUCKET_NAME: '',
  AWS_SECRET_ACCESS_KEY: '',
  AWS_SESSION_TOKEN: '',
  BEDROCK_API_KEY: '',
  COGNITO_CLIENT_ID: '',
  COGNITO_REGION: '',
  COGNITO_USER_POOL_ID: '',
  FAL_KEY: '',
  NEXT_PUBLIC_COGNITO_CLIENT_ID: '',
  NEXT_PUBLIC_COGNITO_DOMAIN: '',
  NEXT_PUBLIC_COGNITO_LOGOUT_URI: '',
  NEXT_PUBLIC_COGNITO_OAUTH_SCOPES: '',
  NEXT_PUBLIC_COGNITO_REDIRECT_URI: '',
  NEXT_PUBLIC_COGNITO_REGION: '',
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: '',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: '',
  OPENAI_API_KEY: '',
  POSTHOG_API_KEY: '',
  SCRIBELESS_API_KEY: '',
  SENDGRID_API_KEY: '',
  SENTRY_DSN: '',
  STRIPE_PUBLISHABLE_KEY: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
});

export const createSafeLocalEnvironment = (sourceEnvironment = process.env, options = {}) => {
  const environment = {};

  for (const [name, value] of Object.entries(sourceEnvironment)) {
    if (value === undefined) {
      continue;
    }

    environment[name] = externalCredentialPattern.test(name) ? '' : value;
  }

  const isolated = options.isolated === true;
  return {
    ...environment,
    ...neutralizedCredentials,
    NODE_ENV: 'development',
    AUTH_MODE: 'local',
    LOCAL_AUTH_SECRET: 'souvenote-local-auth-secret-only-for-development',
    LOCAL_AUTH_CLIENT_ID: 'souvenote-local-web',
    LOCAL_AUTH_SUBJECT: '00000000-0000-4000-8000-000000000001',
    LOCAL_AUTH_EMAIL: 'local@souvenote.invalid',
    LOCAL_AUTH_SCOPE: 'souvenote:customer',
    BFF_SESSION_SECRET: 'souvenote-local-bff-session-secret-development',
    API_INTERNAL_BASE_URL: `http://127.0.0.1:${localPorts.api}/api/v1`,
    COGNITO_REQUIRED_SCOPES: 'souvenote:customer',
    DATABASE_URL: `postgresql://souvenote:souvenote_local@127.0.0.1:${localPorts.postgres}/souvenote`,
    DATABASE_SSL_MODE: 'disable',
    TRUST_PROXY_HOPS: '0',
    HOST: '127.0.0.1',
    WORKER_HOST: '127.0.0.1',
    WORKER_PORT: String(localPorts.worker),
    WORKER_MODE: 'idle',
    IMAGE_PROVIDER_MODE: 'mock',
    MUSIC_PROVIDER_MODE: 'mock',
    TEXT_PROVIDER_MODE: 'mock',
    PAYMENT_PROVIDER_MODE: 'mock',
    TRY_RISK_FREE_RESOLVER_ENABLED: 'false',
    TRY_RISK_FREE_RESOLVER_INTERVAL_MS: '60000',
    FULFILLMENT_PROVIDER_MODE: 'mock',
    BLANK_CARD_HANDOFF_ENABLED: 'true',
    NOTIFICATION_PROVIDER_MODE: 'disabled',
    EMAIL_PROVIDER_MODE: 'disabled',
    ANALYTICS_MODE: 'disabled',
    ERROR_REPORTING_MODE: 'disabled',
    POSTGRES_HOST_PORT: String(localPorts.postgres),
    ...(isolated ? { SOUVENOTE_POSTGRES_VOLUME_NAME: 'souvenote-audit-postgres-data' } : {}),
  };
};

export const workspaceEnvironment = (workspace, baseEnvironment) => {
  switch (workspace) {
    case '@souvenote/web':
      return { ...baseEnvironment, PORT: String(localPorts.web) };
    case '@souvenote/api':
      return { ...baseEnvironment, PORT: String(localPorts.api) };
    case '@souvenote/worker':
      return {
        ...baseEnvironment,
        AUTH_MODE: 'disabled',
        PORT: String(localPorts.worker),
        WORKER_PORT: String(localPorts.worker),
      };
    default:
      throw new Error(`Unknown local workspace: ${workspace}`);
  }
};

export const composeArguments = (...argumentsAfterCompose) => [
  'compose',
  '--project-name',
  defaultComposeProject,
  '--file',
  composeFile,
  ...argumentsAfterCompose,
];

export const composeArgumentsFor = (projectName, ...argumentsAfterCompose) => [
  'compose',
  '--project-name',
  projectName,
  '--file',
  composeFile,
  ...argumentsAfterCompose,
];
