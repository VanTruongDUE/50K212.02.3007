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
       WHERE $1='manager' OR f.assignee_id=$2 ORDER BY f.due_at DESC LIMIT 100`,
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
    @Body() body: { responseId?: unknown; dueAt?: unknown; note?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    if (!Number.isSafeInteger(body?.responseId) || Number(body.responseId) < 1)
      throw new BadRequestException('Response không hợp lệ.');
    const note = body.note === undefined ? null : body.note;
    if (note !== null && (typeof note !== 'string' || note.length > 2000))
      throw new BadRequestException('Ghi chú không hợp lệ.');
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
        { id: string; kind: string; status: string } & QueryResultRow
      >(
        'SELECT id,kind,status FROM responses WHERE id=$1 AND assignee_id=$2 AND hidden_at IS NULL FOR UPDATE',
        [body.responseId, request.account.id],
      );
      if (!response.rows[0]) throw new NotFoundException();
      if (
        ['unsubscribe', 'spam', 'bounce'].includes(response.rows[0].kind) ||
        response.rows[0].status === 'closed'
      )
        throw new ConflictException('Response này không thể Follow-up.');
      const count = await client.query<{ count: string }>(
        'SELECT count(*) FROM followups WHERE response_id=$1',
        [body.responseId],
      );
      const attempt = Number(count.rows[0].count) + 1;
      if (attempt > 3)
        throw new ConflictException('Response đã đạt 3 lần Follow-up.');
      const result = await client.query<Followup>(
        'INSERT INTO followups(response_id,assignee_id,due_at,attempt,note) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [body.responseId, request.account.id, due, attempt, note],
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
        "UPDATE followups SET status='done',note=$2,completed_at=now() WHERE id=$1 AND status='pending' RETURNING *",
        [id, body.note.trim()],
      );
      if (!done.rows[0]) throw new ConflictException('Lịch đã được xử lý.');
      if (body.needsNext && item.attempt < 3) {
        const response = await client.query<
          { status: string; kind: string } & QueryResultRow
        >('SELECT status,kind FROM responses WHERE id=$1 FOR UPDATE', [
          item.response_id,
        ]);
        if (
          response.rows[0] &&
          !['replied', 'closed'].includes(response.rows[0].status) &&
          !['unsubscribe', 'spam', 'bounce'].includes(response.rows[0].kind)
        ) {
          await client.query(
            'INSERT INTO followups(response_id,assignee_id,due_at,attempt) VALUES($1,$2,$3,$4)',
            [
              item.response_id,
              request.account.id,
              afterBusinessDays(new Date(), 2),
              item.attempt + 1,
            ],
          );
        }
      }
      await client.query('COMMIT');
      return done.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
      "DELETE FROM followups WHERE id=$1 AND status='pending' RETURNING id",
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
