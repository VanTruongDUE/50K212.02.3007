import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import { afterBusinessDays } from './business-days';

type Followup = QueryResultRow & {
  id: string;
  response_id: string;
  assignee_id: string;
  status: string;
  attempt: number;
  max_attempts: number;
  interval_days: number;
  channel: string;
  goal: string;
  reminder_minutes: number;
  wait_days: number;
};

@Controller('api/followups')
@UseGuards(SessionGuard)
export class FollowupsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT f.*,r.customer_name,r.email,r.kind,r.status AS response_status,
       (f.status='pending' AND f.due_at<now()) AS overdue
       FROM followups f JOIN responses r ON r.id=f.response_id
       WHERE f.status<>'cancelled' AND ($1='manager' OR f.assignee_id=$2) ORDER BY f.due_at DESC LIMIT 100`,
      [request.account.role, request.account.id],
    );
    return result.rows;
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.one(id, request);
  }

  @Post()
  @Roles('employee')
  async create(
    @Body()
    body: {
      responseId?: unknown;
      dueAt?: unknown;
      note?: unknown;
      channel?: unknown;
      goal?: unknown;
      reminderMinutes?: unknown;
      waitDays?: unknown;
      maxAttempts?: unknown;
      intervalDays?: unknown;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    if (!Number.isSafeInteger(body?.responseId) || Number(body.responseId) < 1)
      throw new BadRequestException('Response không hợp lệ.');
    const note = body.note === undefined ? null : body.note;
    if (note !== null && (typeof note !== 'string' || note.length > 2000))
      throw new BadRequestException('Ghi chú không hợp lệ.');
    const channel = body.channel ?? 'email';
    const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
    const reminderMinutes = body.reminderMinutes ?? 60;
    const waitDays = body.waitDays ?? 2;
    const maxAttempts = body.maxAttempts ?? 3;
    const intervalDays = body.intervalDays ?? 2;
    if (
      typeof channel !== 'string' ||
      !['email', 'sms', 'phone'].includes(channel) ||
      !goal ||
      goal.length > 2000 ||
      !Number.isSafeInteger(reminderMinutes) ||
      Number(reminderMinutes) < 0 ||
      Number(reminderMinutes) > 10080 ||
      !Number.isSafeInteger(waitDays) ||
      Number(waitDays) < 1 ||
      Number(waitDays) > 30 ||
      !Number.isSafeInteger(maxAttempts) ||
      Number(maxAttempts) < 1 ||
      Number(maxAttempts) > 3 ||
      !Number.isSafeInteger(intervalDays) ||
      Number(intervalDays) < 1 ||
      Number(intervalDays) > 30
    )
      throw new BadRequestException('Thông số Follow-up không hợp lệ.');
    const due =
      body.dueAt === undefined
        ? afterBusinessDays(new Date(), 2)
        : typeof body.dueAt === 'string'
          ? new Date(body.dueAt)
          : new Date(NaN);
    if (!Number.isFinite(due.getTime()) || due.getTime() < Date.now())
      throw new BadRequestException('Lịch Follow-up phải ở tương lai.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const response = await client.query<
        {
          id: string;
          kind: string;
          status: string;
          email: string;
        } & QueryResultRow
      >(
        'SELECT id,kind,status,email FROM responses WHERE id=$1 AND assignee_id=$2 AND hidden_at IS NULL FOR UPDATE',
        [body.responseId, request.account.id],
      );
      if (!response.rows[0]) throw new NotFoundException();
      if (
        ['unsubscribe', 'spam', 'bounce'].includes(response.rows[0].kind) ||
        response.rows[0].status === 'closed'
      )
        throw new ConflictException('Response này không thể Follow-up.');
      if (channel === 'email') {
        const suppressed = await client.query(
          'SELECT 1 FROM email_suppressions WHERE email=lower($1)',
          [response.rows[0].email],
        );
        if (suppressed.rowCount)
          throw new ConflictException(
            'Khách hàng đã từ chối nhận email. Chọn kênh liên hệ khác.',
          );
      }
      const count = await client.query<{
        count: string;
        configured_max: number | null;
      }>(
        'SELECT count(*) AS count, min(max_attempts) AS configured_max FROM followups WHERE response_id=$1',
        [body.responseId],
      );
      const attempt = Number(count.rows[0].count) + 1;
      if (attempt > Number(count.rows[0].configured_max ?? maxAttempts))
        throw new ConflictException('Response đã đạt số lần Follow-up tối đa.');
      const result = await client.query<Followup>(
        'INSERT INTO followups(response_id,assignee_id,due_at,attempt,note,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [
          body.responseId,
          request.account.id,
          due,
          attempt,
          note,
          channel,
          goal,
          reminderMinutes,
          waitDays,
          count.rows[0].configured_max ?? maxAttempts,
          intervalDays,
        ],
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException(
          'Response đã có lịch Follow-up chờ thực hiện.',
        );
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/complete')
  @Roles('employee')
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note?: unknown; needsNext?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id || item.status !== 'pending')
      throw new ConflictException('Chỉ hoàn tất lịch đang chờ của bạn.');
    if (
      typeof body?.note !== 'string' ||
      !body.note.trim() ||
      body.note.length > 2000 ||
      (body.needsNext !== undefined && typeof body.needsNext !== 'boolean')
    )
      throw new BadRequestException('Cần ghi chú kết quả Follow-up.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const done = await client.query<Followup>(
        "UPDATE followups SET status='done',note=$2,completed_at=now(),outcome='awaiting',needs_next=$3 WHERE id=$1 AND status='pending' RETURNING *",
        [id, body.note.trim(), Boolean(body.needsNext)],
      );
      if (!done.rows[0]) throw new ConflictException('Lịch đã được xử lý.');
      await client.query('COMMIT');
      return done.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/note')
  @Roles('employee')
  async updateNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id || item.status === 'cancelled')
      throw new ConflictException('Không thể ghi chú lịch đã hủy.');
    if (typeof body?.note !== 'string' || body.note.length > 2000)
      throw new BadRequestException('Ghi chú tối đa 2000 ký tự.');
    const result = await this.database.query<Followup>(
      "UPDATE followups SET note=$2 WHERE id=$1 AND status<>'cancelled' RETURNING *",
      [id, body.note.trim() || null],
    );
    if (!result.rows[0]) throw new ConflictException('Lịch đã được xử lý.');
    return result.rows[0];
  }

  @Delete(':id')
  @Roles('employee')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id) throw new NotFoundException();
    const result = await this.database.query(
      "UPDATE followups SET status='cancelled' WHERE id=$1 AND status='pending' RETURNING id",
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Chỉ xóa lịch Follow-up đang chờ.');
    return { deleted: true };
  }

  private async one(
    id: number,
    request: AuthenticatedRequest,
  ): Promise<Followup> {
    const result = await this.database.query<Followup>(
      "SELECT f.*,r.customer_name,r.email FROM followups f JOIN responses r ON r.id=f.response_id WHERE f.id=$1 AND ($2='manager' OR f.assignee_id=$3)",
      [id, request.account.role, request.account.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
