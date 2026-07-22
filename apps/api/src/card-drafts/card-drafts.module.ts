import { Module } from '@nestjs/common';
import { CardDraftsController } from './card-drafts.controller';
import { CardDraftsService } from './card-drafts.service';
import { CardDraftsRepository } from './card-drafts.repository';

@Module({
  controllers: [CardDraftsController],
  providers: [CardDraftsRepository, CardDraftsService],
})
export class CardDraftsModule {}
