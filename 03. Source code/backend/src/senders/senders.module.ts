import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SendersController } from './senders.controller';
import { SmtpService } from './smtp.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SendersController],
  providers: [SmtpService],
  exports: [SmtpService],
})
export class SendersModule {}
