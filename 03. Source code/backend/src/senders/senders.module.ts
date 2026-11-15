import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SendersController } from './senders.controller';
import { SmtpService } from './smtp.service';
import { GoogleMailService } from './google-mail.service';
import { GoogleMailController } from './google-mail.controller';
import { SmtpRelayController } from './smtp-relay.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GoogleMailController, SendersController, SmtpRelayController],
  providers: [SmtpService, GoogleMailService],
  exports: [SmtpService],
})
export class SendersModule {}
