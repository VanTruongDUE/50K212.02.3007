import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from './auth/roles';
import { SessionGuard } from './auth/session.guard';
import { DatabaseService } from './database/database.service';

@Controller('api/dashboard')
@UseGuards(SessionGuard)
@Roles('manager')
export class DashboardController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async summary(@Query('period') period: string | undefined) {
    if (period !== undefined && period !== 'week' && period !== 'month')
      throw new BadRequestException('Kỳ báo cáo không hợp lệ.');
    const days = period === 'month' ? 30 : 7;
    const result = await this.database.query(
      `SELECT
       (SELECT count(*)::int FROM campaigns WHERE created_at>=now()-($1 * interval '1 day')) AS campaigns,
       (SELECT count(*)::int FROM email_deliveries WHERE state='sent' AND sent_at>=now()-($1 * interval '1 day')) AS emails_sent,
       (SELECT count(*)::int FROM responses WHERE received_at>=now()-($1 * interval '1 day')) AS responses,
       (SELECT count(*)::int FROM responses WHERE status IN ('new','processing') AND hidden_at IS NULL) AS open_responses,
       (SELECT count(*)::int FROM followups WHERE status='pending' AND due_at<=now()) AS due_followups,
       (SELECT count(*)::int FROM sender_accounts WHERE status='active') AS active_sender_accounts`,
      [days],
    );
    return { period: period ?? 'week', ...result.rows[0] };
  }
}
