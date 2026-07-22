import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { json } from 'express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { readPositiveInteger, resolveCorsAllowedOrigins } from './config/runtime-config';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { SecurityHeadersMiddleware } from './common/security-headers.middleware';

export function configureApi(app: INestApplication): OpenAPIObject {
  const configuration = app.get(ConfigService);
  const allowedOrigins = new Set(resolveCorsAllowedOrigins(configuration));
  const bodyLimit = readPositiveInteger(configuration, 'API_JSON_BODY_LIMIT_BYTES', 1_048_576, 10_485_760);
  const requestIds = new RequestIdMiddleware();
  const securityHeaders = new SecurityHeadersMiddleware(configuration);

  app.use(requestIds.use.bind(requestIds));
  app.use(securityHeaders.use.bind(securityHeaders));

  const corsOptions: CorsOptions = {
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
  app.enableCors(corsOptions);
  app.use(
    json({
      limit: bodyLimit,
      strict: true,
      type: 'application/json',
      verify(request, _response, buffer) {
        (request as typeof request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Souvenote API')
    .setDescription('Authenticated Canada-first Souvenote MVP API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'Cognito access token' })
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ApiError = {
    type: 'object',
    required: ['code', 'message', 'requestId'],
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      requestId: { type: 'string' },
      details: { type: 'object', additionalProperties: true },
    },
    additionalProperties: false,
  };
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem ?? {}) as unknown[]) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
      const responses = (operation as { responses: Record<string, unknown> }).responses;
      for (const [status, description] of [
        ['400', 'Invalid request'],
        ['401', 'Authentication required'],
        ['404', 'Resource not found'],
        ['409', 'Request conflict'],
        ['429', 'Rate limit exceeded'],
        ['500', 'Internal server error'],
      ] as const) {
        responses[status] ??= {
          description,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        };
      }
    }
  }
  return document;
}

export function mountDevelopmentApiDocs(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('api/v1/docs', app, document, {
    jsonDocumentUrl: '/api/v1/openapi.json',
    swaggerOptions: { persistAuthorization: false },
  });
}
