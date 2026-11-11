import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
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

type ResponseRow = QueryResultRow & {
  id: string;
  assignee_id: string;
  contact_id: string | null;
  kind: string;
  status: string;
  hidden_at: Date | null;
};
const kinds = [
  'interested',
  'not_interested',
  'need_info',
  'out_of_office',
  'bounce',
  'unsubscribe',
  'spam',
  'other',
];
const statuses = ['new', 'processing', 'replied', 'closed'];

@Controller('api/responses')
@UseGuards(SessionGuard)
export class ResponsesController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT r.*, c.name AS campaign_name FROM responses r LEFT JOIN campaigns c ON c.id=r.campaign_id
       WHERE r.hidden_at IS NULL AND ($1='manager' OR r.assignee_id=$2)
       ORDER BY r.received_at DESC LIMIT 100`,
      [request.account.role, request.account.id],
    );
    return result.rows;
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    const [interactions, followups] = await Promise.all([
      this.database.query(
        'SELECT i.id,i.actor_id,i.channel,i.content,i.created_at FROM response_interactions i WHERE response_id=$1 ORDER BY created_at',
        [id],
      ),
      this.database.query(
        'SELECT id,due_at,attempt,status,note,completed_at FROM followups WHERE response_id=$1 ORDER BY attempt',
        [id],
      ),
    ]);
    return {
      ...item,
      interactions: interactions.rows,
      followups: followups.rows,
    };
  }

  @Post()
  @Roles('employee')
  async create(
    @Body()
    body: {
      customerName?: unknown;
      email?: unknown;
      kind?: unknown;
      content?: unknown;
      campaignId?: unknown;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    const name =
      typeof body?.customerName === 'string' ? body.customerName.trim() : '';
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const content =
      typeof body?.content === 'string' ? body.content.trim() : '';
    if (
      !name ||
      name.length > 200 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !kinds.includes(String(body.kind)) ||
      !content ||
      content.length > 100000
    )
      throw new BadRequestException('Thông tin Response không hợp lệ.');
    if (
      body.campaignId !== undefined &&
      (!Number.isSafeInteger(body.campaignId) || Number(body.campaignId) < 1)
    )
      throw new BadRequestException('Chiến dịch không hợp lệ.');
    const campaignId = body.campaignId ?? null;
    if (campaignId) {
      const campaign = await this.database.query(
        'SELECT 1 FROM campaigns WHERE id=$1 AND owner_id=$2',
        [campaignId, request.account.id],
      );
      if (!campaign.rowCount)
        throw new NotFoundException('Không tìm thấy chiến dịch.');
    }
    const contact = await this.database.query<{ id: string } & QueryResultRow>(
      'SELECT id FROM contacts WHERE lower(email)=$1',
      [email],
    );
    const result = await this.database.query<ResponseRow>(
      `INSERT INTO responses(campaign_id,contact_id,customer_name,email,kind,assignee_id,content)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        campaignId,
        contact.rows[0]?.id ?? null,
        name,
        email,
        body.kind,
        request.account.id,
        content,
      ],
    );
    await this.applySuppression(result.rows[0]);
    return result.rows[0];
  }

  @Patch(':id')
  @Roles('employee')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { kind?: unknown; status?: unknown; content?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (
      item.assignee_id !== request.account.id ||
      !['new', 'processing'].includes(item.status)
    )
      throw new ConflictException('Response này không thể sửa.');
    const kind = body?.kind === undefined ? item.kind : body.kind;
    const status = body?.status === undefined ? item.status : body.status;
    const content = body?.content === undefined ? item.content : body.content;
    if (
      typeof kind !== 'string' ||
      !kinds.includes(kind) ||
      typeof status !== 'string' ||
      !statuses.includes(status) ||
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > 100000
    )
      throw new BadRequestException('Dữ liệu Response không hợp lệ.');
    const result = await this.database.query<ResponseRow>(
      "UPDATE responses SET kind=$2,status=$3,content=$4,updated_at=now() WHERE id=$1 AND assignee_id=$5 AND status IN ('new','processing') RETURNING *",
      [id, kind, status, content.trim(), request.account.id],
    );
    if (!result.rows[0])
      throw new ConflictException('Response đã đổi trạng thái.');
    await this.applySuppression(result.rows[0]);
    return result.rows[0];
  }

  @Post(':id/interactions')
  @Roles('employee')
  async interact(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { channel?: unknown; content?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id) throw new NotFoundException();
    if (
      !['email', 'sms', 'note'].includes(String(body?.channel)) ||
      typeof body?.content !== 'string' ||
      !body.content.trim() ||
      body.content.length > 100000
    )
      throw new BadRequestException('Nội dung tương tác không hợp lệ.');
    const result = await this.database.query(
      'INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,$2,$3,$4) RETURNING *',
      [id, request.account.id, body.channel, body.content.trim()],
    );
    if (body.channel !== 'note')
      await this.database.query(
        "UPDATE responses SET status='replied',updated_at=now() WHERE id=$1 AND status IN ('new','processing')",
        [id],
      );
    return result.rows[0];
  }

  @Post(':id/hide')
  @Roles('employee')
  async hide(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id) throw new NotFoundException();
    const result = await this.database.query(
      `UPDATE responses SET hidden_at=now() WHERE id=$1 AND kind IN ('spam','unsubscribe')
       AND NOT EXISTS(SELECT 1 FROM response_interactions WHERE response_id=$1 AND channel IN ('email','sms'))
       AND NOT EXISTS(SELECT 1 FROM followups WHERE response_id=$1) RETURNING id`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException(
        'Response đã xử lý hoặc có Follow-up không thể ẩn.',
      );
    return { hidden: true };
  }

  @Patch(':id/assignee')
  @Roles('manager')
  async assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { employeeId?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    await this.one(id, request);
    if (typeof body?.employeeId !== 'string')
      throw new BadRequestException('Nhân viên không hợp lệ.');
    const employee = await this.database.query(
      "SELECT 1 FROM login_accounts WHERE employee_id=$1 AND role='employee'",
      [body.employeeId],
    );
    if (!employee.rowCount)
      throw new NotFoundException('Không tìm thấy Nhân viên.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<QueryResultRow>(
        'UPDATE responses SET assignee_id=$2,updated_at=now() WHERE id=$1 RETURNING *',
        [id, body.employeeId],
      );
      await client.query(
        "UPDATE followups SET assignee_id=$2 WHERE response_id=$1 AND status='pending'",
        [id, body.employeeId],
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async one(
    id: number,
    request: AuthenticatedRequest,
  ): Promise<ResponseRow & { content: string }> {
    const result = await this.database.query<ResponseRow & { content: string }>(
      "SELECT * FROM responses WHERE id=$1 AND hidden_at IS NULL AND ($2='manager' OR assignee_id=$3)",
      [id, request.account.role, request.account.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  private async applySuppression(item: ResponseRow): Promise<void> {
    if (!['unsubscribe', 'bounce'].includes(item.kind)) return;
    const result = await this.database.query<
      { email: string } & QueryResultRow
    >('SELECT email FROM responses WHERE id=$1', [item.id]);
    const email = result.rows[0]?.email?.toLowerCase();
    if (!email) return;
    await this.database.query(
      'INSERT INTO email_suppressions(email,reason) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',
      [email, item.kind],
    );
    if (item.kind === 'unsubscribe')
      await this.database.query(
        'UPDATE contacts SET unsubscribed_at=coalesce(unsubscribed_at,now()) WHERE lower(email)=$1',
        [email],
      );
    if (item.kind === 'bounce')
      await this.database.query(
        'UPDATE contacts SET bounced_at=coalesce(bounced_at,now()) WHERE lower(email)=$1',
        [email],
      );
  }
}
