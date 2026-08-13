import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import type { CognitoJwtClaims } from '../src/auth/auth.types';
import { CognitoJwtService } from '../src/auth/cognito-jwt.service';
import { DatabaseService } from '../src/database/database.service';
import { UploadStorageService } from '../src/uploads/upload-storage.service';
import { ModerationService } from '../src/moderation/moderation.service';
import { OperationsEvidenceService } from '../src/operations/operations-evidence.service';
import { PublicCardLinksService } from '../src/public-card-links/public-card-links.service';
import { buildHttpSecurityConfig } from '../src/http-security.config';

const now = '2026-07-22T12:00:00.000Z';
const approvedAssetId = '11111111-1111-4111-8111-111111111111';

function cardDraft(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    occasion: 'Birthday',
    relationship: 'Friend',
    creative_brief: {},
    status: 'draft',
    created_at: now,
    updated_at: now,
  };
}

function order(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    card_draft_id: 'draft-a',
    selected_asset_id: 'asset-a',
    status: 'pending',
    scribeless_job_id: null,
    tracking_url: null,
    recipient_address: {},
    recipient_addresses: [{}],
    sender_address: {},
    qr_code_url: 'mock://souvenote/qr/asset-a',
    offer_code: 'try_risk_free_one_card',
    amount_cents: 999,
    currency: 'cad',
    quantity: 1,
    pricing_snapshot: {},
    checkout_session_id: null,
    payment_id: null,
    fulfillment_job_id: null,
    fulfillment_status_updated_at: null,
    created_at: now,
    updated_at: now,
  };
}

function approvedAsset(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    card_draft_id: 'draft-a',
    generation_job_id: 'job-a',
    asset_type: 'image',
    s3_key: 'generated/user-a/draft-a/job-a/image.png',
    moderation_state: 'approved_mock',
    approved_at: now,
    print_asset_key: null,
    qr_metadata: {},
    created_at: now,
  };
}

describe('authenticated ownership boundary (e2e)', () => {
  let app: INestApplication<App>;

  const databaseService = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      await Promise.resolve();
      const query = sql.replace(/\s+/g, ' ').trim();

      if (query === 'SELECT 1 AS ready;') {
        return { rows: [{ ready: 1 }] };
      }

      if (query.includes('FROM pricing_catalog')) {
        return { rows: [] };
      }

      if (query.includes('FROM card_entitlement_ledger')) {
        const userId = String(params[0]);
        return { rows: [{ balance: userId === 'user-a' ? '4' : '0' }] };
      }

      if (
        query.includes('FROM card_drafts') &&
        query.includes('WHERE user_id = $1')
      ) {
        const userId = String(params[0]);
        return { rows: [cardDraft(`draft-${userId.at(-1)}`, userId)] };
      }

      if (
        query.includes('FROM card_drafts') &&
        query.includes('WHERE id = $1')
      ) {
        const [draftId, userId] = params.map(String);
        return {
          rows:
            draftId === 'draft-a' && userId === 'user-a'
              ? [cardDraft(draftId, userId)]
              : [],
        };
      }

      if (query.includes('INSERT INTO card_drafts')) {
        return { rows: [cardDraft('draft-new', String(params[0]))] };
      }

      if (
        query.includes('FROM assets') &&
        query.includes('WHERE card_draft_id = $1')
      ) {
        const [draftId, userId] = params.map(String);
        return {
          rows:
            draftId === 'draft-a' && userId === 'user-a'
              ? [approvedAsset(approvedAssetId, userId)]
              : [],
        };
      }

      if (
        query.includes('WITH requested AS') &&
        query.includes('UPDATE assets asset')
      ) {
        const [userId, draftId, assetIds] = params;
        return {
          rows:
            userId === 'user-a' &&
            draftId === 'draft-a' &&
            Array.isArray(assetIds) &&
            assetIds.length === 1 &&
            assetIds[0] === approvedAssetId
              ? [approvedAsset(approvedAssetId, 'user-a')]
              : [],
        };
      }

      if (query.includes('FROM orders') && query.includes('WHERE id = $1')) {
        const [orderId, userId] = params.map(String);
        return {
          rows:
            orderId === 'order-a' && userId === 'user-a'
              ? [order(orderId, userId)]
              : [],
        };
      }

      throw new Error(`Unexpected test query: ${query}`);
    }),
  };

  const cognitoJwtService = {
    verifyToken: jest.fn(async (token: string): Promise<CognitoJwtClaims> => {
      await Promise.resolve();
      if (!['token-a', 'token-b', 'token-m', 'token-o'].includes(token)) {
        throw new UnauthorizedException('Invalid bearer token.');
      }

      const suffix = token.at(-1);
      return {
        sub: `cognito-${suffix}`,
        email: `${suffix}@example.com`,
        iss: 'test',
        aud: 'test',
        token_use: 'id',
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...(suffix === 'm' ? { 'cognito:groups': ['moderators'] } : {}),
        ...(suffix === 'o' ? { 'cognito:groups': ['operations'] } : {}),
      };
    }),
  };

  const authService = {
    syncCognitoUser: jest.fn(async (claims: CognitoJwtClaims) => {
      await Promise.resolve();
      const suffix = claims.sub.at(-1);
      const user = { id: `user-${suffix}`, email: claims.email };
      return {
        user,
        starterCredits: {
          granted: false,
          balance: { userId: user.id, balance: 2 },
        },
      };
    }),
  };

  const uploadStorageService = {
    createReadUrl: jest.fn((storageKey: string) =>
      Promise.resolve(
        storageKey.startsWith('mock/')
          ? null
          : 'https://private.s3.example/asset?signature=test',
      ),
    ),
  };

  const moderationService = {
    listPendingJobs: jest.fn().mockResolvedValue({ jobs: [] }),
    recordDecision: jest.fn(),
  };

  const publicCardLinksService = {
    getPublicSouvenote: jest.fn().mockResolvedValue({
      occasion: 'Birthday',
      imageUrl: 'https://private.s3.example/image?signed=test',
      songUrl: 'https://private.s3.example/song?signed=test',
      insideMessage: 'A message for you.',
      assetUrlExpiresInSeconds: 300,
    }),
  };

  const operationsEvidenceService = {
    getOrderEvidence: jest.fn().mockResolvedValue({
      schemaVersion: 1,
      generatedAt: now,
      order: {
        id: '22222222-2222-4222-8222-222222222222',
        status: 'fulfillment_on_hold',
      },
      payments: { items: [], truncated: false },
      stripeWebhookEvents: { items: [], truncated: false },
      fulfillmentAttempts: { items: [], truncated: false },
      generationJobs: { items: [], truncated: false },
      creditEvents: { items: [], truncated: false },
      moderationJobs: { items: [], truncated: false },
      notificationOutbox: { items: [], truncated: false },
      notificationDeliveryEvents: { items: [], truncated: false },
      publicLink: null,
      auditEvents: { items: [], truncated: false },
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(databaseService)
      .overrideProvider(CognitoJwtService)
      .useValue(cognitoJwtService)
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(UploadStorageService)
      .useValue(uploadStorageService)
      .overrideProvider(ModerationService)
      .useValue(moderationService)
      .overrideProvider(PublicCardLinksService)
      .useValue(publicCardLinksService)
      .overrideProvider(OperationsEvidenceService)
      .useValue(operationsEvidenceService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet(buildHttpSecurityConfig('test', 'false').helmetOptions));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps pricing public', async () => {
    await request(app.getHttpServer())
      .get('/api/pricing')
      .expect(200)
      .expect({ data: [] })
      .expect((response) => {
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['x-powered-by']).toBeUndefined();
        expect(response.headers['strict-transport-security']).toBeUndefined();
      });
  });

  it('publishes the versioned retention schedule without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/retention-policy')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          version?: unknown;
          status?: unknown;
          jurisdiction?: unknown;
          schedule?: unknown;
        };

        expect(body.version).toBe('2026-07-25');
        expect(body.status).toBe('staging_baseline_pending_legal_review');
        expect(body.jurisdiction).toBe('British Columbia, Canada');
        expect(Array.isArray(body.schedule)).toBe(true);

        const schedule = body.schedule as Array<Record<string, unknown>>;
        expect(schedule).toContainEqual(
          expect.objectContaining({
            id: 'abandoned_drafts',
            durationDays: 90,
          }),
        );
        expect(schedule).toContainEqual(
          expect.objectContaining({
            id: 'financial_and_order_records',
            durationYears: 6,
          }),
        );
      });
  });

  it('keeps liveness and database readiness probes public', async () => {
    await request(app.getHttpServer())
      .get('/api/health/live')
      .set('X-Request-ID', '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body as unknown).toMatchObject({
          status: 'ok',
          service: 'souvenote-backend',
        });
        expect(headers['x-request-id']).toBe(
          '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d',
        );
      });
    await request(app.getHttpServer())
      .get('/api/health/ready')
      .set('X-Request-ID', 'unsafe request id')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body as unknown).toMatchObject({
          status: 'ok',
          database: 'connected',
        });
        expect(headers['x-request-id']).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      });
  });

  it('serves a tokenized Souvenote without requiring a Cognito session', async () => {
    await request(app.getHttpServer())
      .get(`/api/public/souvenotes/${'A'.repeat(43)}`)
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body as unknown).toMatchObject({
          occasion: 'Birthday',
          songUrl: 'https://private.s3.example/song?signed=test',
        });
        expect(headers['x-robots-tag']).toContain('noindex');
        expect(headers['cache-control']).toContain('no-store');
      });
  });

  it('keeps the Stripe webhook unauthenticated but rejects unsigned payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/stripe/webhook')
      .send({ id: 'evt_unsigned' })
      .expect(400);
  });

  it('keeps the SendGrid webhook unauthenticated but rejects unsigned payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/notifications/sendgrid/webhook')
      .send([{ event: 'delivered' }])
      .expect(400);
  });

  it('correlates unmatched error responses without echoing unsafe input', async () => {
    await request(app.getHttpServer())
      .get('/api/not-a-real-route?private=value')
      .set('X-Request-ID', 'unsafe request id')
      .expect(404)
      .expect(({ headers }) => {
        expect(headers['x-request-id']).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      });
  });

  it('rejects a protected request without a bearer token', async () => {
    await request(app.getHttpServer())
      .get('/api/card-drafts')
      .set('X-Request-ID', '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d')
      .expect(401)
      .expect('X-Request-ID', '018f8b9e-7f27-7dc3-951b-f53e4fa78e3d');
    await request(app.getHttpServer())
      .post('/api/fulfillment/order/order-a/refresh')
      .expect(401);
  });

  it('lists drafts for the authenticated local user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/card-drafts')
      .set('Authorization', 'Bearer token-a')
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      userId: 'user-a',
      cardDrafts: [{ id: 'draft-a', user_id: 'user-a' }],
    });
  });

  it('returns a server-authoritative card balance for the authenticated owner', async () => {
    await request(app.getHttpServer())
      .get('/api/card-entitlements/balance')
      .set('Authorization', 'Bearer token-a')
      .expect(200)
      .expect({ userId: 'user-a', balance: 4 });

    await request(app.getHttpServer())
      .get('/api/card-entitlements/balance')
      .set('Authorization', 'Bearer token-b')
      .expect(200)
      .expect({ userId: 'user-b', balance: 0 });
  });

  it("hides another user's draft and order", async () => {
    await request(app.getHttpServer())
      .get('/api/card-drafts/draft-a')
      .set('Authorization', 'Bearer token-b')
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/orders/order-a')
      .set('Authorization', 'Bearer token-b')
      .expect(404);
  });

  it('returns owned records to their authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/api/card-drafts/draft-a')
      .set('Authorization', 'Bearer token-a')
      .expect(200)
      .expect(({ body }) => {
        expect(body as unknown).toMatchObject({
          cardDraft: { id: 'draft-a', user_id: 'user-a' },
        });
      });

    await request(app.getHttpServer())
      .get('/api/orders/order-a')
      .set('Authorization', 'Bearer token-a')
      .expect(200)
      .expect(({ body }) => {
        expect(body as unknown).toMatchObject({
          order: { id: 'order-a', userId: 'user-a' },
        });
      });
  });

  it('rejects client-supplied ownership and creates with token identity', async () => {
    await request(app.getHttpServer())
      .post('/api/card-drafts')
      .set('Authorization', 'Bearer token-a')
      .send({ userId: 'user-b', occasion: 'Birthday' })
      .expect(400);

    const response = await request(app.getHttpServer())
      .post('/api/card-drafts')
      .set('Authorization', 'Bearer token-a')
      .send({ occasion: 'Birthday' })
      .expect(201);

    expect(response.body as unknown).toMatchObject({
      cardDraft: { id: 'draft-new', user_id: 'user-a' },
    });
  });

  it('persists approvals only for the authenticated owner', async () => {
    await request(app.getHttpServer())
      .post('/api/assets/card-draft/draft-a/approve')
      .set('Authorization', 'Bearer token-b')
      .send({ assetIds: [approvedAssetId] })
      .expect(409);

    const response = await request(app.getHttpServer())
      .post('/api/assets/card-draft/draft-a/approve')
      .set('Authorization', 'Bearer token-a')
      .send({ assetIds: [approvedAssetId] })
      .expect(201);

    expect(response.body as unknown).toMatchObject({
      cardDraftId: 'draft-a',
      assets: [
        {
          id: approvedAssetId,
          userId: 'user-a',
          approvedAt: now,
        },
      ],
    });
  });

  it('rejects browser-supplied order totals and currencies', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', 'Bearer token-a')
      .send({
        cardDraftId: 'draft-a',
        selectedAssetId: approvedAssetId,
        amountCents: 1,
        currency: 'usd',
      })
      .expect(400);
  });

  it('returns ephemeral private media URLs only through an owned asset query', async () => {
    await request(app.getHttpServer())
      .get('/api/assets/card-draft/draft-a')
      .set('Authorization', 'Bearer token-b')
      .expect(200)
      .expect({ cardDraftId: 'draft-a', assets: [] });

    const response = await request(app.getHttpServer())
      .get('/api/assets/card-draft/draft-a')
      .set('Authorization', 'Bearer token-a')
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      cardDraftId: 'draft-a',
      assets: [
        {
          id: approvedAssetId,
          storageKey: 'generated/user-a/draft-a/job-a/image.png',
          readUrl: 'https://private.s3.example/asset?signature=test',
        },
      ],
    });
  });

  it('restricts the moderation queue to configured Cognito groups', async () => {
    await request(app.getHttpServer())
      .get('/api/moderation/jobs')
      .set('Authorization', 'Bearer token-a')
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/moderation/jobs?limit=10')
      .set('Authorization', 'Bearer token-m')
      .expect(200)
      .expect({ jobs: [] });

    expect(moderationService.listPendingJobs).toHaveBeenCalledWith(10);
  });

  it('restricts order evidence to the separate operations-reader group', async () => {
    const evidenceOrderId = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .get(`/api/operations/orders/${evidenceOrderId}/evidence`)
      .set('Authorization', 'Bearer token-a')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/operations/orders/${evidenceOrderId}/evidence`)
      .set('Authorization', 'Bearer token-m')
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/operations/orders/${evidenceOrderId}/evidence`)
      .set('Authorization', 'Bearer token-o')
      .expect(200)
      .expect(({ body, headers }) => {
        expect(body as unknown).toMatchObject({
          schemaVersion: 1,
          order: { id: evidenceOrderId, status: 'fulfillment_on_hold' },
        });
        expect(headers['cache-control']).toBe('private, no-store');
        expect(headers['x-robots-tag']).toBe('noindex, noarchive');
      });

    expect(operationsEvidenceService.getOrderEvidence).toHaveBeenCalledWith(
      evidenceOrderId,
    );
  });

  it('validates the operations evidence order ID before invoking the service', async () => {
    operationsEvidenceService.getOrderEvidence.mockClear();

    await request(app.getHttpServer())
      .get('/api/operations/orders/not-a-uuid/evidence')
      .set('Authorization', 'Bearer token-o')
      .expect(400);

    expect(operationsEvidenceService.getOrderEvidence).not.toHaveBeenCalled();
  });
});
