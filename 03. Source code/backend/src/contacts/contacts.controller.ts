import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
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

type ContactInput = {
  email?: unknown;
  fullName?: unknown;
  jobTitle?: unknown;
  company?: unknown;
  location?: unknown;
  sourceUrl?: unknown;
};
type ListInput = { name?: unknown; criteria?: unknown; contacts?: unknown };
type ListRow = QueryResultRow & {
  id: number;
  owner_id: string;
  employee_review: string;
  confirmed_at: Date | null;
  manager_review: string;
};

@Controller('api/contact-lists')
@UseGuards(SessionGuard)
export class ContactsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT l.*, count(i.contact_id)::int AS contact_count FROM contact_lists l
       LEFT JOIN contact_list_items i ON i.list_id = l.id
       WHERE $1 = 'manager' OR l.owner_id = $2
       GROUP BY l.id ORDER BY l.created_at DESC LIMIT 100`,
      [request.account.role, request.account.id],
    );
    return result.rows;
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const list = await this.getList(id, request);
    const contacts = await this.database.query(
      `SELECT c.id, c.email, c.full_name, c.job_title, c.company, c.location, c.source_url, c.unsubscribed_at
       FROM contacts c JOIN contact_list_items i ON i.contact_id = c.id WHERE i.list_id = $1 ORDER BY c.id`,
      [id],
    );
    return { ...list, contacts: contacts.rows };
  }

  @Post()
  @Roles('employee')
  async create(@Body() body: ListInput, @Req() request: AuthenticatedRequest) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (
      !name ||
      name.length > 100 ||
      !Array.isArray(body.contacts) ||
      !body.contacts.length ||
      body.contacts.length > 1000
    ) {
      throw new BadRequestException(
        'Tên và danh sách từ 1 đến 1000 Contact là bắt buộc.',
      );
    }
    const contacts = body.contacts as ContactInput[];
    const seen = new Set<string>();
    for (const contact of contacts) {
      const email =
        typeof contact?.email === 'string'
          ? contact.email.trim().toLowerCase()
          : '';
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 320 ||
        seen.has(email)
      ) {
        throw new BadRequestException(
          'Email Contact phải hợp lệ và không trùng trong danh sách.',
        );
      }
      seen.add(email);
    }
    if (
      body.criteria !== undefined &&
      (typeof body.criteria !== 'object' ||
        body.criteria === null ||
        Array.isArray(body.criteria))
    ) {
      throw new BadRequestException('Tiêu chí không hợp lệ.');
    }
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query<ListRow>(
        'INSERT INTO contact_lists (name, owner_id, criteria) VALUES ($1, $2, $3) RETURNING *',
        [name, request.account.id, JSON.stringify(body.criteria ?? {})],
      );
      const list = created.rows[0];
      for (const contact of contacts) {
        const email = (contact.email as string).trim().toLowerCase();
        const field = (value: unknown) =>
          typeof value === 'string' ? value.trim().slice(0, 320) : null;
        const saved = await client.query<{ id: number }>(
          `INSERT INTO contacts (email, full_name, job_title, company, location, source_url)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (lower(email)) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
          [
            email,
            field(contact.fullName),
            field(contact.jobTitle),
            field(contact.company),
            field(contact.location),
            field(contact.sourceUrl),
          ],
        );
        await client.query(
          'INSERT INTO contact_list_items (list_id, contact_id) VALUES ($1, $2)',
          [list.id, saved.rows[0].id],
        );
      }
      await client.query('COMMIT');
      return this.detail(list.id, request);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/review')
  @Roles('employee')
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { result?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const list = await this.getList(id, request);
    if (list.owner_id !== request.account.id) throw new ForbiddenException();
    if (list.confirmed_at)
      throw new ConflictException('Danh sách đã xác nhận.');
    if (body?.result !== 'passed' && body?.result !== 'failed')
      throw new BadRequestException('Kết quả phải là passed hoặc failed.');
    const result = await this.database.query(
      'UPDATE contact_lists SET employee_review = $2 WHERE id = $1 AND confirmed_at IS NULL RETURNING *',
      [id, body.result],
    );
    if (!result.rows[0]) throw new ConflictException('Danh sách đã xác nhận.');
    return result.rows[0];
  }

  @Post(':id/confirm')
  @Roles('employee')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const list = await this.getList(id, request);
    if (list.owner_id !== request.account.id) throw new ForbiddenException();
    if (list.employee_review !== 'passed')
      throw new ConflictException('Danh sách chưa đạt yêu cầu.');
    const result = await this.database.query(
      "UPDATE contact_lists SET confirmed_at = coalesce(confirmed_at, now()) WHERE id = $1 AND employee_review='passed' RETURNING *",
      [id],
    );
    if (!result.rows[0])
      throw new ConflictException('Danh sách chưa đạt yêu cầu.');
    return result.rows[0];
  }

  @Post(':id/approval')
  @Roles('manager')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { decision?: unknown; comment?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const list = await this.getList(id, request);
    if (!list.confirmed_at)
      throw new ConflictException('Danh sách chưa được nhân viên xác nhận.');
    if (list.manager_review !== 'pending')
      throw new ConflictException('Danh sách đã được kiểm tra.');
    if (body?.decision !== 'approved' && body?.decision !== 'rejected')
      throw new BadRequestException('Kết quả duyệt không hợp lệ.');
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (body.decision === 'rejected' && !comment)
      throw new BadRequestException('Cần nhập nhận xét khi không đạt.');
    const result = await this.database.query(
      `UPDATE contact_lists SET manager_review = $2, manager_comment = $3,
       reviewed_by = $4, reviewed_at = now() WHERE id = $1 AND confirmed_at IS NOT NULL AND manager_review='pending' RETURNING *`,
      [id, body.decision, comment || null, request.account.id],
    );
    if (!result.rows[0])
      throw new ConflictException('Danh sách đã được kiểm tra.');
    return result.rows[0];
  }

  private async getList(
    id: number,
    request: AuthenticatedRequest,
  ): Promise<ListRow> {
    const result = await this.database.query<ListRow>(
      'SELECT * FROM contact_lists WHERE id = $1',
      [id],
    );
    const list = result.rows[0];
    if (
      !list ||
      (request.account.role !== 'manager' &&
        list.owner_id !== request.account.id)
    )
      throw new NotFoundException('Không tìm thấy danh sách Contact.');
    return list;
  }
}
