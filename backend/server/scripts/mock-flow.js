const fs = require('fs');
const path = require('path');

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
const cognitoIdToken = env.MOCK_FLOW_COGNITO_ID_TOKEN;

if (!cognitoIdToken) {
  throw new Error(
    'MOCK_FLOW_COGNITO_ID_TOKEN is required to run the authenticated mock flow.',
  );
}

function requestHeaders(body) {
  return {
    Authorization: `Bearer ${cognitoIdToken}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function request(method, route, body) {
  const response = await fetch(`${apiBaseUrl}${route}`, {
    method,
    headers: requestHeaders(body),
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
    headers: requestHeaders(body),
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

async function main() {
  const runId = Date.now();

  await request('GET', '/health');
  const authResponse = await request('GET', '/auth/me');
  const user = authResponse.user;
  console.log(`[ok] authenticated local user ${user.email} (${user.id})`);

  await request('POST', '/credits/mock-purchase', {
    amount: 10,
    idempotencyKey: `mock-flow-${runId}-grant`,
  });

  const draftResponse = await request('POST', '/card-drafts', {
    occasion: 'Birthday',
    relationship: 'Friend',
    creativeBrief: {
      tone: 'warm',
      insideMessage: 'Make this feel personal and joyful.',
    },
  });
  const draftId = draftResponse.cardDraft.id;

  await request('POST', '/uploads/mock', {
    cardDraftId: draftId,
    filename: 'mock-photo.png',
    mimeType: 'image/png',
    size: 12345,
  });

  await request('POST', '/generation/start', {
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

  const approvalAssetIds = assetsResponse.assets
    .filter(
      (asset) =>
        asset.generationJobId || asset.generation_job_id,
    )
    .map((asset) => asset.id);
  await request('POST', `/assets/card-draft/${draftId}/approve`, {
    assetIds: approvalAssetIds,
  });

  const orderResponse = await request('POST', '/orders', {
    cardDraftId: draftId,
    selectedAssetId: selectedAsset.id,
    offerCode: 'try_risk_free_one_card',
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
    'Make sure the configured API server is running, Cognito is configured, AI_MOCK_MODE=true, and migrations 001-016 are applied.',
  );
  process.exit(1);
});
