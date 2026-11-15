import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { SmtpService, type RelayMail, type SmtpAccount } from './smtp.service';

@Controller('api/internal/smtp')
export class SmtpRelayController {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly smtp: SmtpService,
  ) {}
  @Post(':action')
  async run(
    @Param('action') action: string,
    @Body() body: { requestId?: unknown },
    @Headers('authorization') authorization?: string,
  ) {
    const secret = this.config.get<string>('SMTP_RELAY_SECRET');
    const digest = (value: string) =>
      createHash('sha256').update(value).digest();
    if (
      !secret?.trim() ||
      !timingSafeEqual(digest(authorization ?? ''), digest(`Bearer ${secret}`))
    )
      throw new UnauthorizedException();
    if (action !== 'verify' && action !== 'send')
      throw new BadRequestException('Unknown SMTP action.');
    if (
      typeof body?.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        body.requestId,
      )
    )
      throw new BadRequestException('Invalid relay request.');
    const pending = await this.database.query<{
      account_email: string;
      mail: RelayMail | null;
    }>(
      "DELETE FROM smtp_relay_requests WHERE id=$1 AND action=$2 AND created_at>now()-interval '2 minutes' RETURNING account_email,mail",
      [body.requestId, action],
    );
    if (!pending.rows[0])
      throw new NotFoundException('Relay request expired or already consumed.');
    const result = await this.database.query<SmtpAccount>(
      "SELECT email,smtp_host,smtp_port,smtp_user,smtp_secret,google_refresh_secret,google_status FROM sender_accounts WHERE lower(email)=lower($1) AND status='active' LIMIT 1",
      [pending.rows[0].account_email],
    );
    if (!result.rows[0]) throw new NotFoundException('Sender unavailable.');
    return this.smtp.relay(
      result.rows[0],
      action,
      pending.rows[0].mail ?? undefined,
    );
  }
}
