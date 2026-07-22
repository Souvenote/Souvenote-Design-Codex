import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { resolveCorsAllowedOrigins, resolveHost, resolvePort, runtimeEnvironment } from './config/runtime-config';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const environment = runtimeEnvironment(configService);
  const host = resolveHost(configService);
  const port = resolvePort(configService);

  app.enableCors({
    origin: resolveCorsAllowedOrigins(configService),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (environment !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Souvenote Backend API')
      .setDescription('Backend API for Souvenote MVP')
      .setVersion('0.1.0')
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);
  }

  await app.listen(port, host);

  logger.log(`Souvenote backend running on http://${host}:${port}`);
  if (environment !== 'production') {
    logger.log(`Swagger docs available at http://${host}:${port}/api/docs`);
  }
}

void bootstrap().catch(() => {
  logger.error('Souvenote backend failed to start.');
  process.exitCode = 1;
});
