import { Module } from '@nestjs/common';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FollowupsModule } from './followups/followups.module';
import { InboxModule } from './inbox/inbox.module';
import { SearchModule } from './search/search.module';
import { DatabaseModule } from './database/database.module';
import { RuntimeJobsController } from './runtime-jobs.controller';

@Module({
  imports: [
    DatabaseModule,
    CampaignsModule,
    FollowupsModule,
    InboxModule,
    SearchModule,
  ],
  controllers: [RuntimeJobsController],
})
export class RuntimeJobsModule {}
