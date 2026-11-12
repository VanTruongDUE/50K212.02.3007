import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FollowupsController } from './followups.controller';
import { FollowupWorker } from './followup.worker';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FollowupsController],
  providers: [FollowupWorker],
})
export class FollowupsModule {}
