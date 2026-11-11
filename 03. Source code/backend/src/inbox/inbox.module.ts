import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SendersModule } from '../senders/senders.module';
import { InboxController, UnmatchedInboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [AuthModule, DatabaseModule, SendersModule],
  controllers: [InboxController, UnmatchedInboxController],
  providers: [InboxService],
})
export class InboxModule {}
