const LOCAL_DEVELOPMENT_ORIGIN = 'http://localhost:3000';

export function parseCorsAllowedOrigins(
  configuredValue: string | undefined,
  nodeEnvironment: string | undefined,
) {
  const configuredOrigins = configuredValue
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!configuredOrigins?.length) {
    if (nodeEnvironment === 'production') {
      throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
    }
    return [LOCAL_DEVELOPMENT_ORIGIN];
  }

  const normalizedOrigins = configuredOrigins.map((value) => {
    if (value === '*') {
      throw new Error(
        'CORS_ALLOWED_ORIGINS cannot contain a wildcard when credentials are enabled.',
      );
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid URL: ${value}`);
    }

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS must contain origins only, without credentials, paths, queries, or fragments: ${value}`,
      );
    }

    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(
      url.hostname.toLowerCase(),
    );
    if (
      nodeEnvironment === 'production' &&
      url.protocol !== 'https:' &&
      !isLoopback
    ) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS must use HTTPS in production: ${value}`,
      );
    }

    return url.origin;
  });

  return [...new Set(normalizedOrigins)];
}
