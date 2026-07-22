import createClient from 'openapi-fetch';
import type { paths } from './generated/openapi.js';

export function createSouvenoteApiClient(
  options: {
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
  } = {},
) {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? '/api/bff',
    fetch: options.fetch,
    credentials: 'same-origin',
  });
}
