import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
