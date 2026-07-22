import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { RuntimeModule } from './runtime/runtime.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [RuntimeModule, HealthModule, SchedulesModule],
})
export class AppModule {}
