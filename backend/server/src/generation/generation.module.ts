import {Module} from '@nestjs/common';
import {GenerationController} from './generation.controller';
import {GenerationService} from './generation.service';
import {CreditsModule} from '../credits/credits.module';

@Module({
    controllers: [GenerationController],
    providers: [GenerationService],
    imports: [CreditsModule],
})
export class GenerationModule {}
