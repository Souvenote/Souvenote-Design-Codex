import {Module} from '@nestjs/common';
import {CardDraftsController} from './card-drafts.controller';
import {CardDraftsService} from './card-drafts.service';

@Module({
    controllers: [CardDraftsController],
    providers: [CardDraftsService],
})
export class CardDraftsModule {}