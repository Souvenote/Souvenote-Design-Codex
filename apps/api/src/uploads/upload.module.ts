import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadRepository } from './upload.repository';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [UploadRepository, UploadService],
})
export class UploadModule {}
