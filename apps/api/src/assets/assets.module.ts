import { Module } from '@nestjs/common';
import { AssetController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';

@Module({
  controllers: [AssetController],
  providers: [AssetsRepository, AssetsService],
})
export class AssetModule {}
