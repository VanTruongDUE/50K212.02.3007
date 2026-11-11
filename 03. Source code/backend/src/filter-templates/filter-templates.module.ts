import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FilterTemplatesController } from './filter-templates.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FilterTemplatesController],
})
export class FilterTemplatesModule {}
