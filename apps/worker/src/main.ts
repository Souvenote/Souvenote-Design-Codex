import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readWorkerRuntimeConfig } from './runtime/runtime-config';

const bootstrap = async (): Promise<void> => {
  const config = readWorkerRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);

  Logger.log('Idle worker scaffold is running; no queues or provider jobs are enabled.', 'Bootstrap');
};

void bootstrap().catch(() => {
  Logger.error('Worker failed to start. Check the local runtime configuration.', 'Bootstrap');
  process.exitCode = 1;
});
