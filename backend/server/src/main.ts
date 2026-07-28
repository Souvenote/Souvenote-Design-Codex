import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { parseCorsAllowedOrigins } from './cors.config';
import { buildHttpSecurityConfig } from './http-security.config';
import { configureSwaggerDocumentation } from './swagger.config';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({ json: true }),
  });
  const configService = app.get(ConfigService);
  const httpSecurity = buildHttpSecurityConfig(
    configService.get<string>('NODE_ENV'),
    configService.get<string>('SWAGGER_ENABLED'),
  );
  app.use(helmet(httpSecurity.helmetOptions));
  const corsAllowedOrigins = parseCorsAllowedOrigins(
    configService.get<string>('CORS_ALLOWED_ORIGINS'),
    configService.get<string>('NODE_ENV'),
  );

  // Allow only explicitly configured browser origins to call the API.
  app.enableCors({
    origin: corsAllowedOrigins,
    credentials: true,
    exposedHeaders: ['X-Request-ID'],
  });

  app.enableShutdownHooks();

  // all endpoints will be prefixed with /api
  app.setGlobalPrefix('api');

  // makes sure that all incoming requests are validated
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerPath = configureSwaggerDocumentation(
    app,
    httpSecurity.swaggerEnabled,
  );

  // Reads .env variables and starts the server
  // If PORT is not set in .env, it defaults to 4000
  const port = configService.get<number>('PORT') ?? 4000;

  // start server
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log({
    event: 'server_started',
    port,
    swaggerPath,
  });
}

void bootstrap();
