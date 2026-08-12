import { Module } from '@nestjs/common';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';
import { FulfillmentRepository } from './fulfillment.repository';
import { DeterministicScribelessAdapter } from './scribeless.adapter';

@Module({
  controllers: [FulfillmentController],
  providers: [FulfillmentRepository, FulfillmentService, DeterministicScribelessAdapter],
  exports: [FulfillmentRepository],
})
export class FulfillmentModule {}
