const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const serverRoot = path.resolve(__dirname, '..');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, '');
      env[key] = value;
      return env;
    }, {});
}

const env = {
  ...readEnvFile(path.join(serverRoot, '.env')),
  ...readEnvFile(path.join(serverRoot, '.env.local')),
  ...process.env,
};

const apiBaseUrl = env.API_BASE_URL || 'http://localhost:4000/api';
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the local mock-flow user.');
}

async function request(method, route, body) {
  const response = await fetch(`${apiBaseUrl}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      `${method} ${route} failed with ${response.status}: ${JSON.stringify(json)}`,
    );
  }

  console.log(`[ok] ${method} ${route} -> ${response.status}`);
  return json;
}

async function expectHttpError(method, route, body, expectedStatus) {
  const response = await fetch(`${apiBaseUrl}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (response.status !== expectedStatus) {
    throw new Error(
      `${method} ${route} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(json)}`,
    );
  }

  console.log(`[ok] ${method} ${route} -> expected ${expectedStatus}`);
}

async function seedMockUser() {
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(
      `
        INSERT INTO users (email, cognito_user_id)
        VALUES ($1, $2)
        ON CONFLICT (email)
        DO UPDATE SET updated_at = NOW()
        RETURNING id, email;
      `,
      [
        env.MOCK_FLOW_EMAIL || 'mock-flow@souvenote.local',
        'mock-flow-local-user',
      ],
    );

    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function main() {
  const runId = Date.now();

  await request('GET', '/health');
  const user = await seedMockUser();
  console.log(`[ok] seeded mock user ${user.email} (${user.id})`);

  await request('POST', '/credits/grant', {
    userId: user.id,
    amount: 10,
    source: 'local_mock_flow',
    idempotencyKey: `mock-flow-${runId}-grant`,
  });

  const draftResponse = await request('POST', '/card-drafts', {
    userId: user.id,
    occasion: 'Birthday',
    relationship: 'Friend',
    creativeBrief: {
      tone: 'warm',
      insideMessage: 'Make this feel personal and joyful.',
    },
  });
  const draftId = draftResponse.cardDraft.id;

  await request('POST', '/uploads/mock', {
    userId: user.id,
    cardDraftId: draftId,
    filename: 'mock-photo.png',
    mimeType: 'image/png',
    size: 12345,
  });

  await request('POST', '/generation/start', {
    userId: user.id,
    cardDraftId: draftId,
    idempotencyKey: `mock-flow-${runId}-generation`,
  });

  const assetsResponse = await request('GET', `/assets/card-draft/${draftId}`);
  const selectedAsset =
    assetsResponse.assets.find(
      (asset) => asset.assetType === 'image' || asset.asset_type === 'image',
    ) ?? assetsResponse.assets[0];

  if (!selectedAsset) {
    throw new Error('No generated or uploaded assets were returned for review.');
  }

  const orderResponse = await request('POST', '/orders', {
    userId: user.id,
    cardDraftId: draftId,
    selectedAssetId: selectedAsset.id,
    offerCode: 'try_risk_free_one_card',
    amountCents: 999,
    currency: 'usd',
    recipientAddress: {
      name: 'Mock Recipient',
      line1: '123 Local Lane',
      city: 'Toronto',
      region: 'ON',
      postalCode: 'M5V 0A1',
      country: 'CA',
    },
    senderAddress: {
      name: 'Mock Sender',
      line1: '456 Dev Street',
      city: 'Toronto',
      region: 'ON',
      postalCode: 'M5V 0B2',
      country: 'CA',
    },
  });
  const orderId = orderResponse.order.id;

  await request('GET', `/orders/${orderId}`);

  const checkoutResponse = await request('POST', '/checkout/start', {
    orderId,
    successUrl: 'http://localhost:3000/checkout/success',
    cancelUrl: 'http://localhost:3000/checkout/cancel',
  });

  await request('POST', '/checkout/mock-success', {
    orderId,
    checkoutSessionId: checkoutResponse.checkoutSession.id,
  });

  const fulfillmentResponse = await request('POST', '/fulfillment/submit', {
    orderId,
  });

  await request('GET', `/fulfillment/order/${orderId}`);

  await expectHttpError(
    'GET',
    '/orders/00000000-0000-0000-0000-000000000000',
    undefined,
    404,
  );
  await expectHttpError('POST', '/checkout/start', { orderId }, 400);

  console.log('\nMock backend flow complete.');
  console.log(
    JSON.stringify(
      {
        userId: user.id,
        draftId,
        selectedAssetId: selectedAsset.id,
        orderId,
        finalOrderStatus: fulfillmentResponse.order.status,
        mockFulfillmentId:
          fulfillmentResponse.fulfillment.mockFulfillmentId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('\nMock backend flow failed.');
  console.error(error.message);
  console.error(
    `Make sure the server is running at ${apiBaseUrl} and migrations 001 + 002 are applied.`,
  );
  process.exit(1);
});
