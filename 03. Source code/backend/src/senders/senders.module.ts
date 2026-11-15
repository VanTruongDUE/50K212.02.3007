import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SendersController } from './senders.controller';
import { SmtpService } from './smtp.service';
import { GoogleMailService } from './google-mail.service';
import { GoogleMailController } from './google-mail.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [GoogleMailController, SendersController],
  providers: [SmtpService, GoogleMailService],
  exports: [SmtpService],
})
export class SendersModule {}
