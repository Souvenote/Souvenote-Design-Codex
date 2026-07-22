import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { RuntimeModule } from './runtime/runtime.module';

@Module({
  imports: [RuntimeModule, HealthModule],
})
export class AppModule {}
