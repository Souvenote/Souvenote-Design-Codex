import type { HelmetOptions } from 'helmet';

export type HttpSecurityConfig = {
  swaggerEnabled: boolean;
  helmetOptions: Readonly<HelmetOptions>;
};

function parseOptionalBoolean(
  value: string | undefined,
  key: string,
  fallback: boolean,
) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${key} must be either true or false.`);
}

export function buildHttpSecurityConfig(
  nodeEnvironment: string | undefined,
  swaggerEnabledValue: string | undefined,
): HttpSecurityConfig {
  const isProduction = nodeEnvironment === 'production';
  const swaggerEnabled = parseOptionalBoolean(
    swaggerEnabledValue,
    'SWAGGER_ENABLED',
    !isProduction,
  );

  return {
    swaggerEnabled,
    helmetOptions: {
      // Swagger UI depends on inline assets. It is local-by-default and must be
      // explicitly enabled in production; every other surface keeps Helmet's
      // default CSP.
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
      // Do not teach development browsers to force HTTPS for a local origin.
      // Production keeps Helmet's one-year HSTS default.
      strictTransportSecurity: isProduction ? undefined : false,
    },
  };
}
