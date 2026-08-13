import { Module } from '@nestjs/common';
import { CardEntitlementsController } from './card-entitlements.controller';
import { CardEntitlementsService } from './card-entitlements.service';

@Module({
  controllers: [CardEntitlementsController],
  providers: [CardEntitlementsService],
  exports: [CardEntitlementsService],
})
export class CardEntitlementsModule {}
