import { fileURLToPath } from 'node:url';
import path from 'node:path';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = path.resolve(moduleDirectory, '..', '..');
export const composeFile = path.join(repositoryRoot, 'compose.yaml');
export const composeProject = 'souvenote-local';

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
  },
  {
    name: 'api',
    url: `http://127.0.0.1:${localPorts.api}/api/health/ready`,
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

export const createSafeLocalEnvironment = (sourceEnvironment = process.env) => {
  const environment = {};

  for (const [name, value] of Object.entries(sourceEnvironment)) {
    if (value === undefined) {
      continue;
    }

    environment[name] = externalCredentialPattern.test(name) ? '' : value;
  }

  return {
    ...environment,
    ...neutralizedCredentials,
    NODE_ENV: 'development',
    AUTH_MODE: 'disabled',
    DATABASE_URL: `postgresql://souvenote:souvenote_local@127.0.0.1:${localPorts.postgres}/souvenote`,
    HOST: '127.0.0.1',
    WORKER_HOST: '127.0.0.1',
    WORKER_PORT: String(localPorts.worker),
    WORKER_MODE: 'idle',
    IMAGE_PROVIDER_MODE: 'mock',
    MUSIC_PROVIDER_MODE: 'mock',
    TEXT_PROVIDER_MODE: 'mock',
    PAYMENT_PROVIDER_MODE: 'disabled',
    FULFILLMENT_PROVIDER_MODE: 'disabled',
    NOTIFICATION_PROVIDER_MODE: 'disabled',
    EMAIL_PROVIDER_MODE: 'disabled',
    ANALYTICS_MODE: 'disabled',
    ERROR_REPORTING_MODE: 'disabled',
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${localPorts.api}/api`,
    POSTGRES_HOST_PORT: String(localPorts.postgres),
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
  composeProject,
  '--file',
  composeFile,
  ...argumentsAfterCompose,
];
