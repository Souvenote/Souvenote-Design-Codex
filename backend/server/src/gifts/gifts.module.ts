import { Module } from '@nestjs/common';
import { CardEntitlementsModule } from '../card-entitlements/card-entitlements.module';
import { CreditsModule } from '../credits/credits.module';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';

@Module({
  imports: [CardEntitlementsModule, CreditsModule],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}
