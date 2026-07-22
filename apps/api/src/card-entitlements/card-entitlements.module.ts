import { Module } from '@nestjs/common';
import { CardEntitlementsController } from './card-entitlements.controller';
import { CardEntitlementsRepository } from './card-entitlements.repository';
import { CardEntitlementsService } from './card-entitlements.service';

@Module({
  controllers: [CardEntitlementsController],
  providers: [CardEntitlementsRepository, CardEntitlementsService],
})
export class CardEntitlementsModule {}
