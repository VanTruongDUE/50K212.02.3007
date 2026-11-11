import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import { InboxService } from './inbox.service';

@Controller('api/sender-accounts')
@UseGuards(SessionGuard)
@Roles('manager')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Post(':id/verify-inbox')
  async verify(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.inbox.verify(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'Không thể kết nối Gmail IMAP. Kiểm tra cấu hình tài khoản và quyền truy cập.',
      );
    }
    return { connected: true };
  }

  @Post(':id/sync-inbox')
  async sync(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.inbox.sync(id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Không thể đồng bộ Gmail IMAP. Kiểm tra cấu hình và thử lại.',
      );
    }
  }
}

@Controller('api/inbox')
@UseGuards(SessionGuard)
@Roles('manager')
export class UnmatchedInboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('unmatched')
  unmatched() {
    return this.inbox.unmatched();
  }

  @Post(':accountId/:validity/:uid/assign')
  assign(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('validity') validity: string,
    @Param('uid', ParseIntPipe) uid: number,
    @Body()
    body: { employeeId?: unknown; campaignId?: unknown; kind?: unknown },
  ) {
    return this.inbox.assign(accountId, validity, uid, body);
  }

  @Post(':accountId/:validity/:uid/ignore')
  ignore(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Param('validity') validity: string,
    @Param('uid', ParseIntPipe) uid: number,
  ) {
    return this.inbox.ignore(accountId, validity, uid);
  }
}
