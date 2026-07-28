import { Module } from '@nestjs/common';
import { UploadModule } from '../uploads/upload.module';
import { PublicCardLinksController } from './public-card-links.controller';
import { PublicCardLinksService } from './public-card-links.service';

@Module({
  imports: [UploadModule],
  controllers: [PublicCardLinksController],
  providers: [PublicCardLinksService],
  exports: [PublicCardLinksService],
})
export class PublicCardLinksModule {}
