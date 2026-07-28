import { buildHttpSecurityConfig } from './http-security.config';

describe('buildHttpSecurityConfig', () => {
  it('keeps local Swagger available without sending local HSTS', () => {
    expect(buildHttpSecurityConfig('development', undefined)).toEqual({
      swaggerEnabled: true,
      helmetOptions: {
        contentSecurityPolicy: false,
        strictTransportSecurity: false,
      },
    });
  });

  it('disables Swagger and keeps Helmet defaults in production', () => {
    expect(buildHttpSecurityConfig('production', undefined)).toEqual({
      swaggerEnabled: false,
      helmetOptions: {
        contentSecurityPolicy: undefined,
        strictTransportSecurity: undefined,
      },
    });
  });

  it('supports an explicit Boolean override', () => {
    expect(buildHttpSecurityConfig('production', ' true ').swaggerEnabled).toBe(
      true,
    );
    expect(buildHttpSecurityConfig('development', 'FALSE').swaggerEnabled).toBe(
      false,
    );
  });

  it('rejects ambiguous values instead of silently exposing Swagger', () => {
    expect(() => buildHttpSecurityConfig('production', 'yes')).toThrow(
      'SWAGGER_ENABLED must be either true or false.',
    );
  });
});
