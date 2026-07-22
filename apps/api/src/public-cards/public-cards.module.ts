import { Module } from '@nestjs/common';
import { PublicCardsController } from './public-cards.controller';
import { PublicCardsRepository } from './public-cards.repository';
import { PublicCardsService } from './public-cards.service';

@Module({
  controllers: [PublicCardsController],
  providers: [PublicCardsRepository, PublicCardsService],
})
export class PublicCardsModule {}
