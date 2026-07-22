import { Global, Module } from '@nestjs/common';
import { readWorkerRuntimeConfig } from './runtime-config';

export const WORKER_RUNTIME_CONFIG = Symbol('WORKER_RUNTIME_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: WORKER_RUNTIME_CONFIG,
      useFactory: readWorkerRuntimeConfig,
    },
  ],
  exports: [WORKER_RUNTIME_CONFIG],
})
export class RuntimeModule {}
