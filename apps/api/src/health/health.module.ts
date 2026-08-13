import { Module } from '@nestjs/common';
import { HealthController, StagingLoadBalancerHealthController } from './health.controller';

@Module({
  controllers: [HealthController, StagingLoadBalancerHealthController],
})
export class HealthModule {}
