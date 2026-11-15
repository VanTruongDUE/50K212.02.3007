import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../auth/roles';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { SearchService } from './search.service';
@Controller('api/contact-searches')
@UseGuards(SessionGuard)
@Roles('employee')
export class SearchController {
  constructor(private search: SearchService) {}
  @Get('capabilities') capabilities() {
    return this.search.capabilities();
  }
  @Post() @HttpCode(202) create(
    @Req() r: AuthenticatedRequest,
    @Body() b: { criteria?: unknown; requestKey?: unknown },
  ) {
    return this.search.create(r.account.id, b);
  }
  @Get('history') history(
    @Req() r: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
  ) {
    if (
      cursor !== undefined &&
      (!/^\d+$/.test(cursor) ||
        !Number.isSafeInteger(Number(cursor)) ||
        Number(cursor) < 1)
    )
      throw new BadRequestException('Phân trang không hợp lệ.');
    return this.search.history(
      r.account.id,
      cursor ? Number(cursor) : undefined,
    );
  }
  @Get(':id') detail(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.search.detail(r.account.id, String(id));
  }
}
