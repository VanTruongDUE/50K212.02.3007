import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { SendersModule } from './senders/senders.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ResponsesModule } from './responses/responses.module';
import { FollowupsModule } from './followups/followups.module';
import { TemplatesModule } from './templates/templates.module';
import { FilterTemplatesModule } from './filter-templates/filter-templates.module';
import { InboxModule } from './inbox/inbox.module';
import { DashboardController } from './dashboard.controller';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '.env'),
    }),
    DatabaseModule,
    AuthModule,
    ContactsModule,
    SendersModule,
    CampaignsModule,
    ResponsesModule,
    FollowupsModule,
    TemplatesModule,
    FilterTemplatesModule,
    InboxModule,
  ],
  controllers: [
    AppController,
    HealthController,
    DashboardController,
    NotificationsController,
  ],
  providers: [AppService],
})
export class AppModule {}
