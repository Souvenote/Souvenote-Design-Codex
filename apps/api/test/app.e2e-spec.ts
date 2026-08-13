import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import request, { type Response } from 'supertest';
import { configureApi } from '../src/api-configuration';
import { AppModule } from '../src/app.module';
import type { AccessTokenClaims } from '../src/auth/auth.types';

type UserPayload = { user: { id: string; email: string } };
type DraftPayload = { cardDraft: { id: string; status: string } };
type UploadPayload = { upload: { id: string; status: string; widthPixels?: number; heightPixels?: number } };
type AssetListPayload = { data: Array<{ id: string; assetType: string; approvedAt?: string | null }> };
type GenerationPayload = {
  generationJob: { id: string; status: string; creditsReserved: number; creditsRefunded: number };
  balance: number;
};
type OrderPayload = { order: { id: string; totalMinor: number; currency: string } };
type CheckoutPayload = {
  checkoutSession: {
    id: string;
    purpose: string;
    orderId: string | null;
    creditPackPurchaseId: string | null;
    status: string;
    collectionMode: string;
    amountMinor: number;
    currency: string;
    checkoutUrl: string | null;
  };
};
type FulfillmentPayload = {
  fulfillmentJob: { id: string; orderId: string; status: string; variant: string; attemptCount: number };
};
type CreditPackPurchasePayload = {
  purchase: {
    id: string;
    offerCode: string;
    status: string;
    provider: string;
    amountMinor: number;
    creditsGranted: number;
    currency: string;
    mockMode: boolean;
    productionEnabled: boolean;
  };
  balance: number;
};

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
    put: (path: string) => request(server).put(path).set('Authorization', `Bearer ${accessToken}`),
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

const validPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8p8AAAAASUVORK5CYII=',
  'base64',
);
const validPngHash = createHash('sha256').update(validPng).digest('hex');

jest.setTimeout(120_000);

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

  async function createApprovedOrder(
    client: ReturnType<typeof authenticated>,
    offerId: string,
    quantity: number,
  ): Promise<OrderPayload['order']> {
    const draft = responseBody<DraftPayload>(
      await client.post('/api/v1/card-drafts').send({ creationRoute: 'build_my_card' }).expect(201),
    ).cardDraft;
    await client
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', `physical-flow-generation-${randomUUID()}`)
      .send({ cardDraftId: draft.id, actionType: 'initial_image_song' })
      .expect(201);
    const assets = responseBody<AssetListPayload>(
      await client.get(`/api/v1/assets?cardDraftId=${draft.id}&limit=100`).expect(200),
    ).data;
    const image = assets.find((asset) => asset.assetType === 'image');
    const song = assets.find((asset) => asset.assetType === 'song');
    const message = assets.find((asset) => asset.assetType === 'message');
    if (!image || !song || !message) throw new Error('Deterministic approved assets are required.');
    await client
      .post(`/api/v1/card-drafts/${draft.id}/approve`)
      .set('Idempotency-Key', `physical-flow-approval-${randomUUID()}`)
      .send({ imageAssetId: image.id, songAssetId: song.id, messageAssetId: message.id })
      .expect(200);
    return responseBody<OrderPayload>(
      await client
        .post('/api/v1/orders')
        .set('Idempotency-Key', `physical-flow-order-${randomUUID()}`)
        .send({
          cardDraftId: draft.id,
          selectedAssetId: image.id,
          offerId,
          quantity,
          recipientAddress: address,
          senderAddress: address,
        })
        .expect(201),
    ).order;
  }

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
    expect(
      responseBody<{
        creative: { image: string; music: string; text: string };
        checkout: string;
        fulfillment: string;
        externalProviderCallsEnabled: boolean;
      }>(await one.get('/api/v1/capabilities').expect(200)),
    ).toMatchObject({
      creative: { image: 'deterministic_mock', music: 'deterministic_mock', text: 'deterministic_mock' },
      checkout: 'deterministic_mock',
      fulfillment: 'deterministic_mock',
      externalProviderCallsEnabled: false,
    });
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
          filename: 'photo.png',
          mimeType: 'image/png',
          size: validPng.length,
          contentSha256: validPngHash,
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
      .set('Idempotency-Key', `complete-before-content-${randomUUID()}`)
      .send({ attestationAccepted: true })
      .expect(409);
    const contentKey = `content-${randomUUID()}`;
    const storedUpload = responseBody<UploadPayload>(
      await one
        .put(`/api/v1/uploads/${uploadOne.id}/content`)
        .set('Content-Type', 'application/octet-stream')
        .set('Idempotency-Key', contentKey)
        .send(validPng)
        .expect(200),
    ).upload;
    expect(storedUpload).toMatchObject({ status: 'upload_done', widthPixels: 1, heightPixels: 1 });
    await one
      .put(`/api/v1/uploads/${uploadOne.id}/content`)
      .set('Content-Type', 'application/octet-stream')
      .set('Idempotency-Key', contentKey)
      .send(validPng)
      .expect(200);
    await two
      .put(`/api/v1/uploads/${uploadOne.id}/content`)
      .set('Content-Type', 'application/octet-stream')
      .set('Idempotency-Key', `content-${randomUUID()}`)
      .send(validPng)
      .expect(404);
    await one
      .patch(`/api/v1/uploads/${uploadOne.id}/complete`)
      .set('Idempotency-Key', `complete-no-rights-${randomUUID()}`)
      .send({ attestationAccepted: false })
      .expect(400);
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
        .send({ cardDraftId: draftOne.id, actionType: 'initial_image_song' })
        .expect(201),
    );
    expect(firstGeneration.balance).toBe(0);
    expect(firstGeneration.generationJob.status).toBe('succeeded');
    const retryGeneration = responseBody<GenerationPayload>(
      await one
        .post('/api/v1/generation-jobs')
        .set('Idempotency-Key', generationKey)
        .send({ cardDraftId: draftOne.id, actionType: 'initial_image_song' })
        .expect(201),
    );
    expect(retryGeneration.generationJob.id).toBe(firstGeneration.generationJob.id);
    expect(retryGeneration.balance).toBe(0);
    await one
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', generationKey)
      .send({ cardDraftId: draftTwo.id, actionType: 'initial_image_song' })
      .expect(409);
    await two.get(`/api/v1/generation-jobs/${firstGeneration.generationJob.id}`).expect(404);
    const generatedAssets = responseBody<AssetListPayload>(
      await one.get(`/api/v1/assets?cardDraftId=${draftOne.id}&limit=100`).expect(200),
    ).data;
    const imageAsset = generatedAssets.find((asset) => asset.assetType === 'image');
    const songAsset = generatedAssets.find((asset) => asset.assetType === 'song');
    const messageAsset = generatedAssets.find((asset) => asset.assetType === 'message');
    expect(imageAsset && songAsset && messageAsset).toBeTruthy();
    await two.get(`/api/v1/assets/${imageAsset?.id}/content`).expect(404);
    const imageContent = await one.get(`/api/v1/assets/${imageAsset?.id}/content`).expect(200);
    expect(imageContent.headers['content-type']).toContain('image/svg+xml');
    expect(Buffer.from(imageContent.body as Uint8Array).toString('utf8')).toContain('DETERMINISTIC BETA MOCK');

    const duplicateApproval = await one
      .post(`/api/v1/card-drafts/${draftOne.id}/approve`)
      .set('Idempotency-Key', `approval-${randomUUID()}`)
      .send({ imageAssetId: messageAsset?.id, messageAssetId: messageAsset?.id })
      .expect(400);
    expect(responseBody<{ code: string }>(duplicateApproval).code).toBe('APPROVAL_ASSETS_MUST_BE_DISTINCT');

    const approvalKey = `approval-${randomUUID()}`;
    const approvalInput = {
      imageAssetId: imageAsset?.id,
      songAssetId: songAsset?.id,
      messageAssetId: messageAsset?.id,
    };
    const approvedDraft = responseBody<DraftPayload>(
      await one
        .post(`/api/v1/card-drafts/${draftOne.id}/approve`)
        .set('Idempotency-Key', approvalKey)
        .send(approvalInput)
        .expect(200),
    ).cardDraft;
    expect(approvedDraft.status).toBe('approved');
    await one
      .post(`/api/v1/card-drafts/${draftOne.id}/approve`)
      .set('Idempotency-Key', approvalKey)
      .send(approvalInput)
      .expect(200);
    await two
      .post(`/api/v1/card-drafts/${draftOne.id}/approve`)
      .set('Idempotency-Key', `approval-${randomUUID()}`)
      .send(approvalInput)
      .expect(404);
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
         (price_book_id, offer_code, offer_type, unit_amount_minor, minimum_quantity, maximum_quantity,
          authorization_amount_minor, no_send_fee_minor, authorization_days, credits_per_card, checkout_enabled)
       VALUES ($1, $2, 'try_risk_free', 999, 1, 1, 999, 200, 5, 10, TRUE) RETURNING id;`,
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
    const checkoutKey = `checkout-${randomUUID()}`;
    const checkout = responseBody<CheckoutPayload>(
      await one.post('/api/v1/checkout').set('Idempotency-Key', checkoutKey).send({ orderId: orderOne.id }).expect(201),
    ).checkoutSession;
    expect(checkout).toMatchObject({
      purpose: 'physical_order',
      orderId: orderOne.id,
      status: 'open',
      collectionMode: 'manual',
      amountMinor: 999,
      currency: 'CAD',
      checkoutUrl: `/checkout/test/${checkout.id}`,
    });
    expect(
      responseBody<CheckoutPayload>(
        await one
          .post('/api/v1/checkout')
          .set('Idempotency-Key', checkoutKey)
          .send({ orderId: orderOne.id })
          .expect(201),
      ).checkoutSession.id,
    ).toBe(checkout.id);
    await two.get(`/api/v1/checkout/${checkout.id}`).expect(404);
    await one
      .post(`/api/v1/checkout/${checkout.id}/mock-complete`)
      .set('Idempotency-Key', `raw-card-rejected-${randomUUID()}`)
      .send({ outcome: 'succeeded', cardNumber: '4242424242424242' })
      .expect(400);
    expect(
      responseBody<CheckoutPayload>(
        await one
          .post(`/api/v1/checkout/${checkout.id}/mock-complete`)
          .set('Idempotency-Key', `checkout-complete-${randomUUID()}`)
          .send({ outcome: 'succeeded' })
          .expect(201),
      ).checkoutSession.status,
    ).toBe('completed');

    await two
      .post('/api/v1/fulfillment-jobs')
      .set('Idempotency-Key', `fulfillment-${randomUUID()}`)
      .send({ orderId: orderOne.id })
      .expect(404);
    const fulfillmentKey = `fulfillment-${randomUUID()}`;
    const fulfillment = responseBody<FulfillmentPayload>(
      await one
        .post('/api/v1/fulfillment-jobs')
        .set('Idempotency-Key', fulfillmentKey)
        .send({ orderId: orderOne.id, variant: 'personalized' })
        .expect(201),
    ).fulfillmentJob;
    expect(fulfillment).toMatchObject({
      orderId: orderOne.id,
      status: 'accepted',
      variant: 'personalized',
      attemptCount: 1,
    });
    await two.get(`/api/v1/fulfillment-jobs/${fulfillment.id}`).expect(404);
    expect(
      responseBody<FulfillmentPayload>(
        await one
          .post('/api/v1/fulfillment-jobs')
          .set('Idempotency-Key', fulfillmentKey)
          .send({ orderId: orderOne.id, variant: 'personalized' })
          .expect(201),
      ).fulfillmentJob.id,
    ).toBe(fulfillment.id);
    expect(
      (
        await pool.query<{ order_status: string; payment_status: string; authorization_status: string }>(
          `SELECT order_record.status AS order_status, payment.status AS payment_status,
                  auth_record.status AS authorization_status
           FROM orders order_record
           JOIN payments payment ON payment.order_id = order_record.id
           JOIN try_risk_free_authorizations auth_record ON auth_record.order_id = order_record.id
           WHERE order_record.id = $1;`,
          [orderOne.id],
        )
      ).rows[0],
    ).toEqual({ order_status: 'in_fulfillment', payment_status: 'captured', authorization_status: 'captured_full' });
  });

  it('preserves the catalog, credit, reservation, and hosted authorization contracts concurrently', async () => {
    const pricingCatalog = responseBody<{
      data: Array<{
        id: string;
        offerId: string;
        unitAmountMinor: number;
        minimumQuantity: number;
        maximumQuantity: number;
        currency: string;
        checkoutEnabled: boolean;
      }>;
      creditPacks: Array<{
        id: string;
        creditQuantity: number;
        unitAmountMinor: number;
        currency: string;
        checkoutEnabled: boolean;
      }>;
    }>(await request(server).get('/api/v1/pricing').expect(200));
    const catalog = pricingCatalog.data;
    expect(
      catalog.map((offer) => ({
        code: offer.id,
        currency: offer.currency,
        enabled: offer.checkoutEnabled,
        max: offer.maximumQuantity,
        min: offer.minimumQuantity,
        price: offer.unitAmountMinor,
      })),
    ).toEqual([
      { code: 'try_risk_free_one_card', currency: 'CAD', enabled: true, max: 1, min: 1, price: 999 },
      { code: 'big_sender_2_10', currency: 'CAD', enabled: true, max: 10, min: 2, price: 899 },
      { code: 'big_sender_11_20', currency: 'CAD', enabled: true, max: 20, min: 11, price: 799 },
      { code: 'big_sender_21_30', currency: 'CAD', enabled: true, max: 30, min: 21, price: 699 },
    ]);
    expect(
      pricingCatalog.creditPacks.map((offer) => ({
        id: offer.id,
        creditQuantity: offer.creditQuantity,
        unitAmountMinor: offer.unitAmountMinor,
        currency: offer.currency,
        checkoutEnabled: offer.checkoutEnabled,
      })),
    ).toEqual([
      {
        id: 'credit_pack_10',
        creditQuantity: 10,
        unitAmountMinor: 200,
        currency: 'CAD',
        checkoutEnabled: true,
      },
      {
        id: 'credit_pack_80',
        creditQuantity: 80,
        unitAmountMinor: 1000,
        currency: 'CAD',
        checkoutEnabled: true,
      },
      {
        id: 'credit_pack_250',
        creditQuantity: 250,
        unitAmountMinor: 2500,
        currency: 'CAD',
        checkoutEnabled: true,
      },
    ]);

    const purchaserToken = token(randomUUID(), `credit-pack-purchaser-${randomUUID()}@example.test`);
    const purchaser = authenticated(server, purchaserToken);
    const purchaserUser = responseBody<UserPayload>(await purchaser.get('/api/v1/me').expect(200)).user;
    expect(responseBody<{ balance: number }>(await purchaser.get('/api/v1/credits').expect(200)).balance).toBe(2);

    const purchaseKey = `credit-pack-checkout-${randomUUID()}`;
    const checkoutResponses = await Promise.all(
      Array.from({ length: 8 }, () =>
        purchaser
          .post('/api/v1/checkout/credit-packs')
          .set('Idempotency-Key', purchaseKey)
          .send({ offerCode: 'credit_pack_10' })
          .expect(201),
      ),
    );
    const packCheckouts = checkoutResponses.map((response) => responseBody<CheckoutPayload>(response).checkoutSession);
    expect(new Set(packCheckouts.map((session) => session.id)).size).toBe(1);
    expect(packCheckouts[0]).toMatchObject({
      purpose: 'credit_pack',
      status: 'open',
      amountMinor: 200,
      currency: 'CAD',
      collectionMode: 'automatic',
    });
    expect(responseBody<{ balance: number }>(await purchaser.get('/api/v1/credits').expect(200)).balance).toBe(2);
    const packSession = packCheckouts[0];
    expect(packSession).toBeDefined();
    const completionResponses = await Promise.all(
      Array.from({ length: 8 }, () =>
        purchaser
          .post(`/api/v1/checkout/${packSession?.id}/mock-complete`)
          .set('Idempotency-Key', `credit-pack-complete-${randomUUID()}`)
          .send({ outcome: 'succeeded' })
          .expect(201),
      ),
    );
    expect(
      completionResponses.every(
        (response) => responseBody<CheckoutPayload>(response).checkoutSession.status === 'completed',
      ),
    ).toBe(true);
    const firstPurchaseId = packSession?.creditPackPurchaseId;
    expect(firstPurchaseId).toBeDefined();
    const firstPurchase = responseBody<CreditPackPurchasePayload>(
      await purchaser.get(`/api/v1/credits/purchases/${firstPurchaseId}`).expect(200),
    );
    expect(firstPurchase.purchase).toMatchObject({
      offerCode: 'credit_pack_10',
      status: 'captured',
      provider: 'mock',
      amountMinor: 200,
      creditsGranted: 10,
      currency: 'CAD',
      mockMode: true,
      productionEnabled: false,
    });
    expect(responseBody<{ balance: number }>(await purchaser.get('/api/v1/credits').expect(200)).balance).toBe(12);
    await purchaser
      .post('/api/v1/checkout/credit-packs')
      .set('Idempotency-Key', purchaseKey)
      .send({ offerCode: 'credit_pack_80' })
      .expect(409);

    const secondCheckout = responseBody<CheckoutPayload>(
      await purchaser
        .post('/api/v1/checkout/credit-packs')
        .set('Idempotency-Key', `credit-pack-checkout-${randomUUID()}`)
        .send({ offerCode: 'credit_pack_80' })
        .expect(201),
    ).checkoutSession;
    await purchaser
      .post(`/api/v1/checkout/${secondCheckout.id}/mock-complete`)
      .set('Idempotency-Key', `credit-pack-complete-${randomUUID()}`)
      .send({ outcome: 'succeeded' })
      .expect(201);
    expect(responseBody<{ balance: number }>(await purchaser.get('/api/v1/credits').expect(200)).balance).toBe(92);
    await purchaser
      .post('/api/v1/checkout/credit-packs')
      .set('Idempotency-Key', `credit-pack-invalid-${randomUUID()}`)
      .send({ offerCode: 'credit_pack_999' })
      .expect(400);
    await purchaser
      .post('/api/v1/credits/purchases/mock')
      .set('Idempotency-Key', `retired-immediate-capture-${randomUUID()}`)
      .send({ offerCode: 'credit_pack_10' })
      .expect(409);
    const purchaseLedger = await pool.query<{ count: string; amount: string }>(
      `SELECT count(*)::text AS count, COALESCE(sum(amount), 0)::text AS amount
       FROM credit_ledger
       WHERE user_id = $1
         AND event_type = 'purchase_grant'
         AND source_type = 'credit_pack_purchase';`,
      [purchaserUser.id],
    );
    expect(purchaseLedger.rows[0]).toEqual({ count: '2', amount: '90' });
    expect(
      (
        await pool.query<{ count: string }>(
          `SELECT count(*)::text AS count
           FROM credit_pack_purchases
           WHERE user_id = $1 AND status = 'captured';`,
          [purchaserUser.id],
        )
      ).rows[0]?.count,
    ).toBe('2');

    const otherPurchaser = authenticated(server, token(randomUUID(), `credit-pack-other-${randomUUID()}@example.test`));
    await otherPurchaser.get('/api/v1/me').expect(200);
    await otherPurchaser.get(`/api/v1/credits/purchases/${firstPurchaseId}`).expect(404);
    await purchaser.get(`/api/v1/credits/purchases/${firstPurchaseId}`).expect(200);

    const primaryToken = token(randomUUID(), `section-three-primary-${randomUUID()}@example.test`);
    const primary = authenticated(server, primaryToken);
    const primaryUser = responseBody<UserPayload>(await primary.get('/api/v1/me').expect(200)).user;
    const draft = responseBody<DraftPayload>(
      await primary
        .post('/api/v1/card-drafts')
        .send({ creationRoute: 'build_my_card', creativeBrief: { mockScenario: 'timeout_song' } })
        .expect(201),
    ).cardDraft;

    const initialKey = `section-three-initial-${randomUUID()}`;
    const initialResponses = await Promise.all(
      Array.from({ length: 8 }, () =>
        primary
          .post('/api/v1/generation-jobs')
          .set('Idempotency-Key', initialKey)
          .send({ cardDraftId: draft.id, actionType: 'initial_image_song' })
          .expect(201),
      ),
    );
    const initialJobs = initialResponses.map((response) => responseBody<GenerationPayload>(response));
    expect(new Set(initialJobs.map((response) => response.generationJob.id)).size).toBe(1);
    const initialJobId = initialJobs[0]?.generationJob.id;
    expect(initialJobId).toBeDefined();
    expect(
      (
        await pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM credit_ledger
           WHERE user_id = $1 AND event_type = 'generation_reservation' AND amount = -2;`,
          [primaryUser.id],
        )
      ).rows[0]?.count,
    ).toBe('1');

    expect(
      responseBody<{ generationJob: { status: string; creditsRefunded: number } }>(
        await primary.get(`/api/v1/generation-jobs/${initialJobId}`).expect(200),
      ).generationJob,
    ).toMatchObject({ status: 'refunded', creditsRefunded: 2 });
    expect(responseBody<{ balance: number }>(await primary.get('/api/v1/credits').expect(200)).balance).toBe(2);
    expect(
      (
        await pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM credit_ledger
           WHERE user_id = $1 AND event_type = 'generation_refund' AND amount = 2;`,
          [primaryUser.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
    const partialAssets = responseBody<AssetListPayload>(
      await primary.get(`/api/v1/assets?cardDraftId=${draft.id}&limit=100`).expect(200),
    ).data;
    expect(partialAssets.some((asset) => asset.assetType === 'image')).toBe(true);
    expect(partialAssets.some((asset) => asset.assetType === 'song')).toBe(false);
    await primary.patch(`/api/v1/card-drafts/${draft.id}`).send({ creativeBrief: {} }).expect(200);

    const imageRegeneration = responseBody<GenerationPayload>(
      await primary
        .post('/api/v1/generation-jobs')
        .set('Idempotency-Key', `section-three-image-${randomUUID()}`)
        .send({ cardDraftId: draft.id, actionType: 'regenerate_image' })
        .expect(201),
    );
    expect(imageRegeneration.balance).toBe(1);
    const insideMessage = responseBody<GenerationPayload>(
      await primary
        .post('/api/v1/generation-jobs')
        .set('Idempotency-Key', `section-three-message-${randomUUID()}`)
        .send({ cardDraftId: draft.id, actionType: 'inside_message' })
        .expect(201),
    );
    expect(insideMessage.balance).toBe(1);
    await primary
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', `section-three-song-${randomUUID()}`)
      .send({ cardDraftId: draft.id, actionType: 'regenerate_song' })
      .expect(201);
    await primary
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', `section-three-overdraw-${randomUUID()}`)
      .send({ cardDraftId: draft.id, actionType: 'regenerate_image' })
      .expect(409);

    await primary
      .post('/api/v1/card-entitlements/reservations')
      .set('Idempotency-Key', `section-three-invalid-${randomUUID()}`)
      .send({ quantity: 1 })
      .expect(400);
    const reservationKey = `section-three-reservation-${randomUUID()}`;
    const reservationResponses = await Promise.all(
      Array.from({ length: 8 }, () =>
        primary
          .post('/api/v1/card-entitlements/reservations')
          .set('Idempotency-Key', reservationKey)
          .send({ quantity: 11 })
          .expect(201),
      ),
    );
    const reservations = reservationResponses.map((response) =>
      responseBody<{
        reservation: { id: string; quantity: number; unitAmountMinor: number; totalAmountMinor: number };
      }>(response),
    );
    expect(new Set(reservations.map((response) => response.reservation.id)).size).toBe(1);
    expect(reservations[0]?.reservation).toMatchObject({ quantity: 11, unitAmountMinor: 799, totalAmountMinor: 8789 });
    await primary
      .post('/api/v1/card-entitlements/reservations')
      .set('Idempotency-Key', reservationKey)
      .send({ quantity: 12 })
      .expect(409);
    const reservationId = reservations[0]?.reservation.id;
    expect(reservationId).toBeDefined();
    const releaseKey = `section-three-release-${randomUUID()}`;
    const released = await Promise.all(
      Array.from({ length: 8 }, () =>
        primary
          .post(`/api/v1/card-entitlements/reservations/${reservationId}/release`)
          .set('Idempotency-Key', releaseKey)
          .send({})
          .expect(200),
      ),
    );
    expect(
      released.every(
        (response) => responseBody<{ reservation: { status: string } }>(response).reservation.status === 'released',
      ),
    ).toBe(true);
    await primary
      .post(`/api/v1/card-entitlements/reservations/${reservationId}/release`)
      .set('Idempotency-Key', `section-three-release-conflict-${randomUUID()}`)
      .send({})
      .expect(409);

    const authorizationToken = token(randomUUID(), `section-three-auth-${randomUUID()}@example.test`);
    const authorizationClient = authenticated(server, authorizationToken);
    const authorizationUser = responseBody<UserPayload>(await authorizationClient.get('/api/v1/me').expect(200)).user;
    const authorizationDraft = responseBody<DraftPayload>(
      await authorizationClient.post('/api/v1/card-drafts').send({ creationRoute: 'build_my_card' }).expect(201),
    ).cardDraft;
    await authorizationClient
      .post('/api/v1/generation-jobs')
      .set('Idempotency-Key', `authorization-generation-${randomUUID()}`)
      .send({ cardDraftId: authorizationDraft.id, actionType: 'initial_image_song' })
      .expect(201);
    const authorizationAssets = responseBody<AssetListPayload>(
      await authorizationClient.get(`/api/v1/assets?cardDraftId=${authorizationDraft.id}&limit=100`).expect(200),
    ).data;
    const authorizationImage = authorizationAssets.find((asset) => asset.assetType === 'image');
    const authorizationSong = authorizationAssets.find((asset) => asset.assetType === 'song');
    const authorizationMessage = authorizationAssets.find((asset) => asset.assetType === 'message');
    expect(authorizationImage && authorizationSong && authorizationMessage).toBeTruthy();
    await authorizationClient
      .post(`/api/v1/card-drafts/${authorizationDraft.id}/approve`)
      .set('Idempotency-Key', `authorization-approval-${randomUUID()}`)
      .send({
        imageAssetId: authorizationImage?.id,
        songAssetId: authorizationSong?.id,
        messageAssetId: authorizationMessage?.id,
      })
      .expect(200);
    const tryRiskFreeOfferId = pricingCatalog.data.find((offer) => offer.id === 'try_risk_free_one_card')?.offerId;
    expect(tryRiskFreeOfferId).toBeDefined();
    const authorizationOrder = responseBody<OrderPayload>(
      await authorizationClient
        .post('/api/v1/orders')
        .set('Idempotency-Key', `authorization-order-${randomUUID()}`)
        .send({
          cardDraftId: authorizationDraft.id,
          selectedAssetId: authorizationImage?.id,
          offerId: tryRiskFreeOfferId,
          quantity: 1,
          recipientAddress: address,
          senderAddress: address,
        })
        .expect(201),
    ).order;
    const authorizationCheckout = responseBody<CheckoutPayload>(
      await authorizationClient
        .post('/api/v1/checkout')
        .set('Idempotency-Key', `authorization-checkout-${randomUUID()}`)
        .send({ orderId: authorizationOrder.id })
        .expect(201),
    ).checkoutSession;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        authorizationClient
          .post(`/api/v1/checkout/${authorizationCheckout.id}/mock-complete`)
          .set('Idempotency-Key', `authorization-complete-${randomUUID()}`)
          .send({ outcome: 'succeeded' })
          .expect(201),
      ),
    );
    const authorizationRecord = await pool.query<{ id: string }>(
      `SELECT id FROM try_risk_free_authorizations WHERE order_id = $1 AND user_id = $2;`,
      [authorizationOrder.id, authorizationUser.id],
    );
    const authorizationId = authorizationRecord.rows[0]?.id;
    expect(authorizationId).toBeDefined();
    expect(
      responseBody<{ balance: number }>(await authorizationClient.get('/api/v1/credits').expect(200)).balance,
    ).toBe(10);
    await authorizationClient
      .post('/api/v1/card-entitlements/try-risk-free/authorizations')
      .set('Idempotency-Key', `section-three-second-authorization-${randomUUID()}`)
      .send({})
      .expect(409);
    expect(
      (
        await pool.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM credit_ledger
           WHERE user_id = $1 AND event_type = 'purchase_grant' AND amount = 10;`,
          [authorizationUser.id],
        )
      ).rows[0]?.count,
    ).toBe('1');
    await pool.query(
      `UPDATE try_risk_free_authorizations
       SET authorized_at = authorized_at - INTERVAL '6 days',
           authorization_expires_at = authorization_expires_at - INTERVAL '6 days'
       WHERE id = $1;`,
      [authorizationId],
    );
    const resolverRuns = await Promise.all(
      Array.from({ length: 8 }, () =>
        pool.query('SELECT authorization_id FROM resolve_due_try_risk_free_authorizations(clock_timestamp(), 100);'),
      ),
    );
    expect(resolverRuns.reduce((total, run) => total + (run.rowCount ?? 0), 0)).toBe(1);
    expect(
      (
        await pool.query<{
          status: string;
          captured_amount_minor: number;
          released_amount_minor: number;
          payment_status: string;
          order_status: string;
        }>(
          `SELECT auth_record.status, auth_record.captured_amount_minor,
                  auth_record.released_amount_minor, payment.status AS payment_status,
                  order_record.status AS order_status
           FROM try_risk_free_authorizations auth_record
           JOIN payments payment ON payment.id = auth_record.payment_id
           JOIN orders order_record ON order_record.id = auth_record.order_id
           WHERE auth_record.id = $1;`,
          [authorizationId],
        )
      ).rows[0],
    ).toEqual({
      status: 'captured_no_send',
      captured_amount_minor: 200,
      released_amount_minor: 799,
      payment_status: 'captured',
      order_status: 'canceled',
    });
  });

  it('captures Big Sender exactly once and feature-gates the one-card blank handoff payload', async () => {
    const pricing = responseBody<{
      data: Array<{ id: string; offerId: string }>;
    }>(await request(server).get('/api/v1/pricing').expect(200));
    const tryRiskFreeOfferId = pricing.data.find((offer) => offer.id === 'try_risk_free_one_card')?.offerId;
    const bigSenderOfferId = pricing.data.find((offer) => offer.id === 'big_sender_2_10')?.offerId;
    if (!tryRiskFreeOfferId || !bigSenderOfferId) throw new Error('Physical offers are required.');

    const blankClient = authenticated(server, token(randomUUID(), `blank-handoff-${randomUUID()}@example.test`));
    const blankUser = responseBody<UserPayload>(await blankClient.get('/api/v1/me').expect(200)).user;
    const blankOrder = await createApprovedOrder(blankClient, tryRiskFreeOfferId, 1);
    const blankCheckout = responseBody<CheckoutPayload>(
      await blankClient
        .post('/api/v1/checkout')
        .set('Idempotency-Key', `blank-checkout-${randomUUID()}`)
        .send({ orderId: blankOrder.id })
        .expect(201),
    ).checkoutSession;
    await blankClient
      .post(`/api/v1/checkout/${blankCheckout.id}/mock-complete`)
      .set('Idempotency-Key', `blank-complete-${randomUUID()}`)
      .send({ outcome: 'succeeded' })
      .expect(201);
    const blankFulfillment = responseBody<FulfillmentPayload>(
      await blankClient
        .post('/api/v1/fulfillment-jobs')
        .set('Idempotency-Key', `blank-fulfillment-${randomUUID()}`)
        .send({ orderId: blankOrder.id, variant: 'blank_handoff' })
        .expect(201),
    ).fulfillmentJob;
    expect(blankFulfillment).toMatchObject({ status: 'accepted', variant: 'blank_handoff' });
    expect(
      (
        await pool.query<{ handoff_status: string; entitlement_status: string }>(
          `SELECT handoff.status AS handoff_status, entitlement.status AS entitlement_status
           FROM blank_card_handoffs handoff
           JOIN card_entitlements entitlement ON entitlement.id = handoff.entitlement_id
           WHERE handoff.user_id = $1 AND handoff.order_id = $2;`,
          [blankUser.id, blankOrder.id],
        )
      ).rows[0],
    ).toEqual({ handoff_status: 'submitted', entitlement_status: 'consumed' });

    const bigSenderClient = authenticated(server, token(randomUUID(), `big-sender-${randomUUID()}@example.test`));
    const bigSenderUser = responseBody<UserPayload>(await bigSenderClient.get('/api/v1/me').expect(200)).user;
    const bigSenderOrder = await createApprovedOrder(bigSenderClient, bigSenderOfferId, 2);
    const bigSenderCheckout = responseBody<CheckoutPayload>(
      await bigSenderClient
        .post('/api/v1/checkout')
        .set('Idempotency-Key', `big-sender-checkout-${randomUUID()}`)
        .send({ orderId: bigSenderOrder.id })
        .expect(201),
    ).checkoutSession;
    expect(bigSenderCheckout).toMatchObject({ collectionMode: 'automatic', amountMinor: 1798, currency: 'CAD' });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        bigSenderClient
          .post(`/api/v1/checkout/${bigSenderCheckout.id}/mock-complete`)
          .set('Idempotency-Key', `big-sender-complete-${randomUUID()}`)
          .send({ outcome: 'succeeded' })
          .expect(201),
      ),
    );
    expect(responseBody<{ balance: number }>(await bigSenderClient.get('/api/v1/credits').expect(200)).balance).toBe(
      20,
    );
    const beforeFulfillment = await pool.query<{
      quantity_total: number;
      quantity_consumed: number;
      status: string;
    }>(
      `SELECT quantity_total, quantity_consumed, status FROM card_entitlements
       WHERE user_id = $1 AND source_type = 'big_sender' AND source_id = $2;`,
      [bigSenderUser.id, bigSenderOrder.id],
    );
    expect(beforeFulfillment.rows[0]).toEqual({ quantity_total: 2, quantity_consumed: 0, status: 'available' });
    await bigSenderClient
      .post('/api/v1/fulfillment-jobs')
      .set('Idempotency-Key', `big-sender-fulfillment-${randomUUID()}`)
      .send({ orderId: bigSenderOrder.id })
      .expect(201);
    expect(
      (
        await pool.query<{ quantity_consumed: number; status: string; payment_status: string }>(
          `SELECT entitlement.quantity_consumed, entitlement.status, payment.status AS payment_status
           FROM card_entitlements entitlement
           JOIN payments payment ON payment.order_id = entitlement.source_id
           WHERE entitlement.user_id = $1 AND entitlement.source_id = $2;`,
          [bigSenderUser.id, bigSenderOrder.id],
        )
      ).rows[0],
    ).toEqual({ quantity_consumed: 2, status: 'consumed', payment_status: 'captured' });

    const jobColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fulfillment_jobs';`,
    );
    expect(jobColumns.rows.map((row) => row.column_name)).not.toContain('request_payload');
    expect(jobColumns.rows.map((row) => row.column_name)).not.toContain('response_payload');
  });

  it('accepts only verified, idempotent webhook events and stores hashes instead of payloads', async () => {
    const body = { id: `evt_${randomUUID()}`, type: 'payment_intent.succeeded', data: { object: { id: 'pi_test' } } };
    const raw = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedHeader = (payload: string) =>
      `t=${timestamp},v1=${createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET ?? '')
        .update(timestamp)
        .update('.')
        .update(payload)
        .digest('hex')}`;
    const header = signedHeader(raw);

    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', header).send(body).expect(201);
    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', header).send(body).expect(201);
    await request(server).post('/api/v1/webhooks/stripe').set('stripe-signature', 'invalid').send(body).expect(401);

    const webhookClient = authenticated(server, token(randomUUID(), `webhook-recovery-${randomUUID()}@example.test`));
    const webhookUser = responseBody<UserPayload>(await webhookClient.get('/api/v1/me').expect(200)).user;
    const checkout = responseBody<CheckoutPayload>(
      await webhookClient
        .post('/api/v1/checkout/credit-packs')
        .set('Idempotency-Key', `webhook-checkout-${randomUUID()}`)
        .send({ offerCode: 'credit_pack_10' })
        .expect(201),
    ).checkoutSession;
    const providerSessionId = `cs_test_${randomUUID().replaceAll('-', '')}`;
    await pool.query(
      `UPDATE checkout_sessions
       SET provider = 'stripe', provider_session_id = $2,
           expires_at = clock_timestamp() - INTERVAL '1 minute'
       WHERE id = $1;`,
      [checkout.id, providerSessionId],
    );
    await pool.query(`UPDATE credit_pack_purchases SET provider = 'stripe' WHERE id = $1;`, [
      checkout.creditPackPurchaseId,
    ]);
    const recoveryBody = {
      id: `evt_${randomUUID()}`,
      type: 'checkout.session.completed',
      data: { object: { id: providerSessionId, payment_intent: `pi_${randomUUID().replaceAll('-', '')}` } },
    };
    const recoveryRaw = JSON.stringify(recoveryBody);
    const recoveryHeader = signedHeader(recoveryRaw);
    await request(server)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', recoveryHeader)
      .send(recoveryBody)
      .expect(500);
    await pool.query(
      `UPDATE checkout_sessions SET expires_at = clock_timestamp() + INTERVAL '30 minutes' WHERE id = $1;`,
      [checkout.id],
    );
    await request(server)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', recoveryHeader)
      .send(recoveryBody)
      .expect(201);
    await request(server)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', recoveryHeader)
      .send(recoveryBody)
      .expect(201);
    expect(responseBody<{ balance: number }>(await webhookClient.get('/api/v1/credits').expect(200)).balance).toBe(12);
    expect(
      (
        await pool.query<{ status: string; attempt_count: number; ledger_count: string }>(
          `SELECT event.status, event.attempt_count,
                  (SELECT count(*)::text FROM credit_ledger ledger
                   WHERE ledger.user_id = $2 AND ledger.source_type = 'credit_pack_purchase') AS ledger_count
           FROM webhook_events event
           WHERE event.provider = 'stripe' AND event.provider_event_id = $1;`,
          [recoveryBody.id, webhookUser.id],
        )
      ).rows[0],
    ).toEqual({ status: 'processed', attempt_count: 2, ledger_count: '1' });
    const conflictingBody = { ...recoveryBody, type: 'checkout.session.async_payment_failed' };
    await request(server)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', signedHeader(JSON.stringify(conflictingBody)))
      .send(conflictingBody)
      .expect(409);

    const stored = await pool.query<{ payload_sha256: string; status: string; attempt_count: number }>(
      'SELECT payload_sha256, status, attempt_count FROM webhook_events WHERE provider = $1 AND provider_event_id = $2;',
      ['stripe', body.id],
    );
    expect(stored.rows[0]?.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.rows[0]).toMatchObject({ status: 'ignored', attempt_count: 1 });
    const schema = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'webhook_events';`,
    );
    expect(schema.rows.map((row) => row.column_name)).not.toContain('payload');
  });
});
