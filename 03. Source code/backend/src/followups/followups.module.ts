import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FollowupsController } from './followups.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FollowupsController],
})
export class FollowupsModule {}
