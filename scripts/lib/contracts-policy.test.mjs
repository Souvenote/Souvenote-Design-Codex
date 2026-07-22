import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const document = JSON.parse(await readFile(new URL('../../packages/contracts/openapi.json', import.meta.url), 'utf8'));

const requiredResources = [
  '/api/v1/me',
  '/api/v1/pricing',
  '/api/v1/credits',
  '/api/v1/card-entitlements',
  '/api/v1/card-drafts',
  '/api/v1/uploads',
  '/api/v1/generation-jobs',
  '/api/v1/assets',
  '/api/v1/orders',
  '/api/v1/checkout',
  '/api/v1/fulfillment-jobs',
  '/api/v1/public/cards/{shareToken}',
  '/api/v1/webhooks/stripe',
  '/api/v1/webhooks/scribeless',
];

const idempotentOperations = [
  ['post', '/api/v1/uploads'],
  ['patch', '/api/v1/uploads/{uploadId}/complete'],
  ['post', '/api/v1/generation-jobs'],
  ['post', '/api/v1/orders'],
  ['post', '/api/v1/checkout'],
  ['post', '/api/v1/fulfillment-jobs'],
];

test('OpenAPI publishes every Section 2 resource and stable state contract', () => {
  for (const resource of requiredResources) assert.ok(document.paths[resource], `missing OpenAPI resource ${resource}`);
  assert.deepEqual(document.components.schemas.ApiError.required, ['code', 'message', 'requestId']);
  assert.deepEqual(document.components.schemas.GenerationJobViewDto.properties.status.enum, [
    'queued',
    'running',
    'succeeded',
    'partially_failed',
    'failed',
    'refunded',
    'canceled',
    'approved',
  ]);
  assert.deepEqual(document.components.schemas.UploadViewDto.properties.status.enum, [
    'upload_pending',
    'upload_done',
    'moderation_pending',
    'moderation_passed',
    'moderation_failed',
    'attestation_required',
    'attestation_done',
    'committed',
  ]);
});

test('protected resources declare bearer auth and public resources do not', () => {
  for (const [method, resource] of [
    ['get', '/api/v1/me'],
    ['get', '/api/v1/credits'],
    ['post', '/api/v1/card-drafts'],
    ['get', '/api/v1/orders'],
  ]) {
    assert.deepEqual(
      document.paths[resource][method].security,
      [{ bearer: [] }],
      `${method} ${resource} must be protected`,
    );
  }
  for (const [method, resource] of [
    ['get', '/api/v1/health/live'],
    ['get', '/api/v1/pricing'],
    ['get', '/api/v1/public/cards/{shareToken}'],
    ['post', '/api/v1/webhooks/stripe'],
  ]) {
    assert.equal(
      document.paths[resource][method].security,
      undefined,
      `${method} ${resource} must be explicitly public`,
    );
  }
});

test('sensitive customer mutations require documented idempotency headers', () => {
  for (const [method, resource] of idempotentOperations) {
    const parameters = document.paths[resource][method].parameters ?? [];
    const header = parameters.find((parameter) => parameter.in === 'header' && parameter.name === 'Idempotency-Key');
    assert.ok(header, `${method} ${resource} is missing Idempotency-Key`);
    assert.equal(header.required, true);
    assert.equal(header.schema.minLength, 16);
    assert.equal(header.schema.maxLength, 128);
  }
});

test('owned collections expose bounded cursor pagination', () => {
  for (const resource of [
    '/api/v1/card-entitlements',
    '/api/v1/card-drafts',
    '/api/v1/generation-jobs',
    '/api/v1/assets',
    '/api/v1/orders',
  ]) {
    const parameters = document.paths[resource].get.parameters ?? [];
    const limit = parameters.find((parameter) => parameter.in === 'query' && parameter.name === 'limit');
    const cursor = parameters.find((parameter) => parameter.in === 'query' && parameter.name === 'cursor');
    assert.equal(limit?.schema.minimum, 1, `${resource} minimum limit`);
    assert.equal(limit?.schema.maximum, 100, `${resource} maximum limit`);
    assert.equal(cursor?.schema.format, 'uuid', `${resource} cursor format`);
  }
});
