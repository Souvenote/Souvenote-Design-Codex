import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { getReadinessSnapshot } from './health.mjs';

test('readiness honors a bounded per-target startup timeout', async () => {
  const server = http.createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ready');
    }, 75);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });

  try {
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, 'object');
    const url = `http://127.0.0.1:${address.port}/health`;

    const tooShort = await getReadinessSnapshot([
      { name: 'slow startup', url, json: false, requestTimeoutMilliseconds: 10 },
    ]);
    assert.equal(tooShort['slow startup'], false);

    const boundedStartup = await getReadinessSnapshot([
      { name: 'slow startup', url, json: false, requestTimeoutMilliseconds: 500 },
    ]);
    assert.equal(boundedStartup['slow startup'], true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
