import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ContactsController } from './contacts.controller';
import { UnsubscribeController } from './unsubscribe.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ContactsController, UnsubscribeController],
})
export class ContactsModule {}
