import { Module } from '@nestjs/common';
import { UploadModule } from '../uploads/upload.module';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ModeratorGuard } from './moderator.guard';

@Module({
  imports: [UploadModule],
  controllers: [ModerationController],
  providers: [ModerationService, ModeratorGuard],
  exports: [ModerationService],
})
export class ModerationModule {}
