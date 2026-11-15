import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SerpProvider } from './serp.provider';
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SearchController],
  providers: [SearchService, SerpProvider],
})
export class SearchModule {}
