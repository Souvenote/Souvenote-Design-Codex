import { Global, Module } from '@nestjs/common';
import { LocalObjectStorageService } from './local-object-storage.service';

@Global()
@Module({
  providers: [LocalObjectStorageService],
  exports: [LocalObjectStorageService],
})
export class StorageModule {}
