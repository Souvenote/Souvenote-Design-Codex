import { parseCorsAllowedOrigins } from './cors.config';

describe('parseCorsAllowedOrigins', () => {
  it('uses the local frontend only during development', () => {
    expect(parseCorsAllowedOrigins(undefined, 'development')).toEqual([
      'http://localhost:3000',
    ]);
    expect(() => parseCorsAllowedOrigins(undefined, 'production')).toThrow(
      'CORS_ALLOWED_ORIGINS is required in production.',
    );
  });

  it('normalizes and deduplicates configured origins', () => {
    expect(
      parseCorsAllowedOrigins(
        'https://app.example.com, https://admin.example.com/, https://app.example.com',
        'production',
      ),
    ).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  it.each([
    '*',
    'https://app.example.com/path',
    'https://user:secret@app.example.com',
    'http://app.example.com',
  ])('rejects unsafe production input %s', (value) => {
    expect(() => parseCorsAllowedOrigins(value, 'production')).toThrow();
  });
});
