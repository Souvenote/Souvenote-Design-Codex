import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import type { App } from 'supertest/types';
import { buildHttpSecurityConfig } from '../src/http-security.config';
import {
  configureSwaggerDocumentation,
  SWAGGER_PATH,
} from '../src/swagger.config';

@Controller('security-probe')
class SecurityProbeController {
  @Get()
  probe() {
    return { status: 'ok' };
  }
}

describe('production HTTP edge (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [SecurityProbeController],
    }).compile();
    const config = buildHttpSecurityConfig('production', undefined);

    app = moduleFixture.createNestApplication();
    app.use(helmet(config.helmetOptions));
    app.setGlobalPrefix('api');
    configureSwaggerDocumentation(app, config.swaggerEnabled);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets the production header policy', async () => {
    await request(app.getHttpServer())
      .get('/api/security-probe')
      .expect(200)
      .expect({ status: 'ok' })
      .expect((response) => {
        expect(response.headers['content-security-policy']).toContain(
          "default-src 'self'",
        );
        expect(response.headers['strict-transport-security']).toContain(
          'max-age=31536000',
        );
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['x-powered-by']).toBeUndefined();
      });
  });

  it.each([SWAGGER_PATH, `${SWAGGER_PATH}-json`, `${SWAGGER_PATH}-yaml`])(
    'does not expose production documentation at %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(404);
    },
  );
});
