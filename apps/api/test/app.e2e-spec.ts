import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import request, { type Response } from 'supertest';
import { configureApi } from '../src/api-configuration';
import { AppModule } from '../src/app.module';
import type { AccessTokenClaims } from '../src/auth/auth.types';

type UserPayload = { user: { id: string; email: string } };
type DraftPayload = { cardDraft: { id: string; status: string } };
type UploadPayload = { upload: { id: string; status: string } };
type AssetListPayload = { data: Array<{ id: string; assetType: string }> };
type GenerationPayload = { generationJob: { id: string }; balance: number };
type OrderPayload = { order: { id: string; totalMinor: number; currency: string } };

const localSecret = process.env.LOCAL_AUTH_SECRET ?? '';
const localClient = process.env.LOCAL_AUTH_CLIENT_ID ?? 'souvenote-local-web';
const requiredScope = process.env.COGNITO_REQUIRED_SCOPES ?? 'souvenote:customer';

function responseBody<T>(response: Response): T {
  const parsed: unknown = JSON.parse(response.text);
  return parsed as T;
}

function token(subject: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: AccessTokenClaims = {
    sub: subject,
    email,
    email_verified: true,
    iss: 'souvenote-local',
    client_id: localClient,
    token_use: 'access',
    scope: requiredScope,
    iat: now - 1,
    exp: now + 600,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', localSecret).update(`souvenote-local.${payload}`).digest('base64url');
  return `souvenote-local.${payload}.${signature}`;
}

function authenticated(server: Server, accessToken: string) {
  return {
    get: (path: string) => request(server).get(path).set('Authorization', `Bearer ${accessToken}`),
    post: (path: string) => request(server).post(path).set('Authorization', `Bearer ${accessToken}`),
    patch: (path: string) => request(server).patch(path).set('Authorization', `Bearer ${accessToken}`),
  };
}

const address = {
  name: 'Test Person',
  line1: '100 Test Street',
  city: 'Vancouver',
  region: 'BC',
  postalCode: 'V6B 1A1',
  country: 'CA' as const,
};

describe('Section 2 API security boundary (integration)', () => {
  let app: INestApplication;
  let server: Server;
  let pool: Pool;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || localSecret.length < 32) {
      throw new Error('The isolated DATABASE_URL and local authentication secrets are required for integration tests.');
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApi(app);
    await app.init();
    server = app.getHttpServer() as Server;
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool?.end();
    await app?.close();
  });

  it('keeps public routes explicit and defaults product routes to authenticated access', async () => {
    await request(server).get('/api/v1/health/live').expect(200);
    await request(server).get('/api/v1/pricing').expect(200);

    const protectedResponse = await request(server)
      .get('/api/v1/credits')
      .set('X-Request-Id', 'integration-request-1')
      .expect(401);
    expect(protectedResponse.headers['x-request-id']).toBe('integration-request-1');
    expect(responseBody<{ code: string; requestId: string }>(protectedResponse)).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED', requestId: 'integration-request-1' }),
    );
    expect(protectedResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(protectedResponse.headers['x-frame-options']).toBe('DENY');
    expect(protectedResponse.headers['cache-control']).toBe('no-store');

    const accessToken = token('cookie-boundary-user', 'cookie-boundary@example.test');
    const cookieBoundary = await authenticated(server, accessToken)
      .post('/api/v1/card-drafts')
      .set('Cookie', 'souvenote_access=sealed-browser-session')
      .send({ creationRoute: 'build_my_card' })
      .expect(403);
    expect(responseBody<{ code: string }>(cookieBoundary).code).toBe('COOKIE_AUTH_NOT_ACCEPTED');

    const allowedCors = await request(server).get('/api/v1/pricing').set('Origin', 'http://127.0.0.1:3000').expect(200);
    expect(allowedCors.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
    const deniedCors = await request(server).get('/api/v1/pricing').set('Origin', 'https://evil.example').expect(200);
    expect(deniedCors.headers['access-control-allow-origin']).toBeUndefined();

    const oversized = await request(server)
      .post('/api/v1/card-drafts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ creationRoute: 'build_my_card', creativeBrief: 'x'.repeat(1_100_000) })
      .expect(413);
    const oversizedBody = responseBody<{ code: string; requestId: string }>(oversized);
    expect(oversizedBody.code).toBe('PAYLOAD_TOO_LARGE');
    expect(typeof oversizedBody.requestId).toBe('string');
    expect(oversizedBody.requestId.length).toBeGreaterThan(0);
  });

  it('provisions once, rejects caller authority, and hides every owned resource across users', async () => {
    const subjectOne = randomUUID();
    const subjectTwo = randomUUID();
    const tokenOne = token(subjectOne, 'owner-one@example.test');
    const tokenTwo = token(subjectTwo, 'owner-two@example.test');
    const one = authenticated(server, tokenOne);
    const two = authenticated(server, tokenTwo);

    const provisioning = await Promise.all(Array.from({ length: 8 }, () => one.get('/api/v1/me').expect(200)));
    const userOne = responseBody<UserPayload>(provisioning[0]).user;
    const userTwo = responseBody<UserPayload>(await two.get('/api/v1/me').expect(200)).user;
    expect(responseBody<{ balance: number }>(await one.get('/api/v1/credits').expect(200)).balance).toBe(2);
    const starter = await pool.query<{ count: string; amount: string }>(
      `SELECT count(*)::text AS count, COALESCE(sum(amount), 0)::text AS amount
       FROM credit_ledger WHERE user_id = $1 AND event_type = 'signup_grant';`,
      [userOne.id],
    );
    expect(starter.rows[0]).toEqual({ count: '1', amount: '2' });

    await one.post('/api/v1/card-drafts').send({ creationRoute: 'build_my_card', userId: userTwo.id }).expect(400);
    const draftOne = responseBody<DraftPayload>(
      await one.post('/api/v1/card-drafts').send({ creationRoute: 'build_my_card', occasion: 'Birthday' }).expect(201),
    ).cardDraft;
    const draftTwo = responseBody<DraftPayload>(
      await two.post('/api/v1/card-drafts').send({ creationRoute: 'personalize_template' }).expect(201),
    ).cardDraft;
    await one.get('/api/v1/card-drafts?limit=101').expect(400);
    const firstPage = responseBody<{ data: Array<{ id: string }>; nextCursor: string | null }>(
      await one.get('/api/v1/card-drafts?limit=1').expect(200),
    );
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.nextCursor).toBe(firstPage.data[0]?.id);
    expect(
      responseBody<{ data: unknown[] }>(await two.get(`/api/v1/card-drafts?cursor=${draftOne.id}`).expect(200)).data,
    ).toEqual([]);
    await two.get(`/api/v1/card-drafts/${draftOne.id}`).expect(404);
    await two.patch(`/api/v1/card-drafts/${draftOne.id}`).send({ occasion: 'Probe' }).expect(404);

    const uploadKey = `upload-${randomUUID()}`;
    const uploadOne = responseBody<UploadPayload>(
      await one
        .post('/api/v1/uploads')
        .set('Idempotency-Key', uploadKey)
        .send({
          cardDraftId: draftOne.id,
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          contentSha256: 'a'.repeat(64),
        })
        .expect(201),
    ).upload;
    await two.get(`/api/v1/uploads/${uploadOne.id}`).expect(404);
    await two
      .post('/api/v1/uploads')
      .set('Idempotency-Key', `upload-${randomUUID()}`)
      .send({
        cardDraftId: draftOne.id,
        filename: 'cross-owner.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        contentSha256: 'b'.repeat(64),
      })
      .expect(404);

    const completeKey = `complete-${randomUUID()}`;
    await one
      .patch(`/api/v1/uploads/${uploadOne.id}/complete`)
      .set('Idempotency-Key', completeKey)
      .send({ attestationAccepted: true })
      .expect(200);
    await one
      .patch(`/api/v1/uploads/${uploadOne.id}/complete`)
      .set('Idempotency-Key', completeKey)
      .send({ attestationAccepted: true })
      .expect(200);
    await one
      .patch(`/api/v1/uploads/${uploadOne.id}/complete`)
      .set('Idempotency-Key', `complete-${randomUUID()}`)
      .send({ attestationAccepted: true })
      .expect(409);
    const assets = responseBody<AssetListPayload>(
      await one.get(`/api/v1/assets?cardDraftId=${draftOne.id}`).expect(200),
    ).data;
    const uploadAsset = assets.find((asset) => asset.assetType === 'upload');
    expect(uploadAsset).toBeDefined();
    await two.get(`/api/v1/assets/${uploadAsset?.id}`).expect(404);
    expect(
      responseBody<AssetListPayload>(await two.get(`/api/v1/assets?cardDraftId=${draftOne.id}`).expect(200)).data,
    ).toEqual([]);

    await one.post('/api/v1/generation-jobs').send({ cardDraftId: draftOne.id }).expect(400);
    const generationKey = `generation-${randomUUID()}`;
    const firstGeneration = responseBody<GenerationPayload>(
      await one
        .post('/api/v1/generation-jobs')
        .set('Idempotency-Key', generationKey)
        .send({ cardDraftId: draftOne.id })
        .expect(201),
    );
    expect(firstGeneration.balance).toBe(0);
    const retryGeneration = responseBody<GenerationPayload>(
      await one
        .post('/api/v1/generation-jobs')
        .set('Idempotency-Key', generationKey)
        .send({ cardDraftId: draftOne.id })
        .expect(201),
    );
    expect(retryGeneration.generationJob.id).toBe(firstGeneration.generationJob.id);
    expect(retryGeneration.balance).toBe(0);
    await one
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', generationKey)
      .send({ cardDraftId: draftTwo.id })
      .expect(409);
    await two.get(`/api/v1/generation-jobs/${firstGeneration.generationJob.id}`).expect(404);
    await request(server)
      .post('/api/v1/credits')
      .set('Authorization', `Bearer ${tokenOne}`)
      .send({ amount: 100 })
      .expect(404);
    await one.get('/api/v1/payment-methods').expect(404);
    await one
      .post('/api/v1/payment-methods')
      .send({ paymentDetails: 'caller-controlled', userId: userTwo.id })
      .expect(404);

    const revision = await pool.query<{ current_revision_id: string }>(
      'SELECT current_revision_id FROM card_drafts WHERE id = $1 AND user_id = $2;',
      [draftOne.id, userOne.id],
    );
    await pool.query("UPDATE card_drafts SET status = 'generating' WHERE id = $1;", [draftOne.id]);
    await pool.query("UPDATE card_drafts SET status = 'review' WHERE id = $1;", [draftOne.id]);
    await pool.query("UPDATE card_drafts SET status = 'approved' WHERE id = $1;", [draftOne.id]);
    const printAsset = await pool.query<{ id: string }>(
      `INSERT INTO assets
         (user_id, card_draft_id, revision_id, asset_type, storage_key, media_type, content_sha256, byte_size,
          moderation_status)
       VALUES ($1, $2, $3, 'print', $4, 'application/pdf', $5, 4096, 'passed') RETURNING id;`,
      [
        userOne.id,
        draftOne.id,
        revision.rows[0]?.current_revision_id,
        `integration/${randomUUID()}.pdf`,
        'c'.repeat(64),
      ],
    );
    await pool.query("UPDATE assets SET generation_status = 'generating' WHERE id = $1;", [printAsset.rows[0]?.id]);
    await pool.query("UPDATE assets SET generation_status = 'ready' WHERE id = $1;", [printAsset.rows[0]?.id]);
    const priceBook = await pool.query<{ id: string }>(
      `INSERT INTO price_books (code, market_country, currency, status)
       VALUES ($1, 'CA', 'CAD', 'active') RETURNING id;`,
      [`INTEGRATION-${randomUUID()}`],
    );
    const offer = await pool.query<{ id: string }>(
      `INSERT INTO price_offers
         (price_book_id, offer_code, offer_type, unit_amount_minor, minimum_quantity, maximum_quantity, checkout_enabled)
       VALUES ($1, $2, 'try_risk_free', 999, 1, 1, TRUE) RETURNING id;`,
      [priceBook.rows[0]?.id, `integration-${randomUUID()}`],
    );
    const orderInput = {
      cardDraftId: draftOne.id,
      selectedAssetId: printAsset.rows[0]?.id,
      offerId: offer.rows[0]?.id,
      quantity: 1,
      recipientAddress: address,
      senderAddress: address,
    };
    await one
      .post('/api/v1/orders')
      .set('Idempotency-Key', `order-${randomUUID()}`)
      .send({ ...orderInput, totalMinor: 1, currency: 'USD', userId: userTwo.id })
      .expect(400);
    const orderKey = `order-${randomUUID()}`;
    const orderOne = responseBody<OrderPayload>(
      await one.post('/api/v1/orders').set('Idempotency-Key', orderKey).send(orderInput).expect(201),
    ).order;
    expect(orderOne).toMatchObject({ totalMinor: 999, currency: 'CAD' });
    const retriedOrder = responseBody<OrderPayload>(
      await one.post('/api/v1/orders').set('Idempotency-Key', orderKey).send(orderInput).expect(201),
    ).order;
    expect(retriedOrder.id).toBe(orderOne.id);
    await two.get(`/api/v1/orders/${orderOne.id}`).expect(404);
    await two
      .post('/api/v1/checkout')
      .set('Idempotency-Key', `checkout-${randomUUID()}`)
      .send({ orderId: orderOne.id })
      .expect(404);
    await one
      .post('/api/v1/checkout')
      .set('Idempotency-Key', `checkout-${randomUUID()}`)
      .send({ orderId: orderOne.id })
      .expect(409);

    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1;", [orderOne.id]);
    const fulfillment = await pool.query<{ id: string }>(
      `INSERT INTO fulfillment_jobs
         (user_id, order_id, provider, request_payload_sha256, idempotency_key)
       VALUES ($1, $2, 'mock', $3, $4) RETURNING id;`,
      [userOne.id, orderOne.id, 'd'.repeat(64), `fixture-${randomUUID()}`],
    );
    await two.get(`/api/v1/fulfillment-jobs/${fulfillment.rows[0]?.id}`).expect(404);
    await two
      .post('/api/v1/fulfillment-jobs')
      .set('Idempotency-Key', `fulfillment-${randomUUID()}`)
      .send({ orderId: orderOne.id })
      .expect(404);
    await one
      .post('/api/v1/fulfillment-jobs')
      .set('Idempotency-Key', `fulfillment-${randomUUID()}`)
      .send({ orderId: orderOne.id })
      .expect(409);
  });

  it('accepts only verified, idempotent webhook events and stores hashes instead of payloads', async () => {
    const body = { id: `evt_${randomUUID()}`, type: 'payment_intent.succeeded', data: { object: { id: 'pi_test' } } };
    const raw = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET ?? '')
      .update(timestamp)
      .update('.')
      .update(raw)
      .digest('hex');
    const header = `t=${timestamp},v1=${signature}`;

    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', header).send(body).expect(201);
    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', header).send(body).expect(201);
    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', 'invalid').send(body).expect(401);

    const stored = await pool.query<{ payload_sha256: string }>(
      'SELECT payload_sha256 FROM webhook_events WHERE provider = $1 AND provider_event_id = $2;',
      ['stripe', body.id],
    );
    expect(stored.rows[0]?.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    const schema = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'webhook_events';`,
    );
    expect(schema.rows.map((row) => row.column_name)).not.toContain('payload');
  });
});
