import { Module } from '@nestjs/common';
import { AssetController } from './assets.controller';
import { AssetsServices } from './assets.service';
import { UploadModule } from '../uploads/upload.module';

@Module({
  controllers: [AssetController],
  providers: [AssetsServices],
  imports: [UploadModule],
})
export class AssetModule {}
