import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import {
  createS3Client,
  defaultPresignedPostFactory,
  defaultS3GetSignedUrlFactory,
  S3_CLIENT,
  S3_GET_SIGNED_URL,
  S3_PRESIGNED_POST,
  UploadStorageService,
} from './upload-storage.service';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    UploadStorageService,
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: createS3Client,
    },
    {
      provide: S3_PRESIGNED_POST,
      useValue: defaultPresignedPostFactory,
    },
    {
      provide: S3_GET_SIGNED_URL,
      useValue: defaultS3GetSignedUrlFactory,
    },
  ],
  exports: [S3_CLIENT, UploadStorageService],
})
export class UploadModule {}
