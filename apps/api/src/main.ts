import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApi, mountDevelopmentApiDocs } from './api-configuration';
import { AppModule } from './app.module';
import { resolveHost, resolvePort, resolveTrustProxyHops, runtimeEnvironment } from './config/runtime-config';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);
  const environment = runtimeEnvironment(configService);
  const host = resolveHost(configService);
  const port = resolvePort(configService);
  const trustProxyHops = resolveTrustProxyHops(configService);
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);
  const document = configureApi(app);
  if (environment !== 'production') mountDevelopmentApiDocs(app, document);

  await app.listen(port, host);
  logger.log(`Souvenote API listening on http://${host}:${port}/api/v1`);
}

void bootstrap().catch(() => {
  logger.error('Souvenote API failed to start.');
  process.exitCode = 1;
});
