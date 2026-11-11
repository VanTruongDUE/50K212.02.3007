import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CampaignsController } from './campaigns.controller';
import { SendersModule } from '../senders/senders.module';
import { DeliveryWorker } from './delivery.worker';
import { AssetsController } from './assets.controller';

@Module({
  imports: [AuthModule, DatabaseModule, SendersModule],
  controllers: [CampaignsController, AssetsController],
  providers: [DeliveryWorker],
})
export class CampaignsModule {}
