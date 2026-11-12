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
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import { SmtpService, type SmtpAccount } from '../senders/smtp.service';

type ResponseRow = QueryResultRow & {
  id: string;
  assignee_id: string;
  contact_id: string | null;
  customer_name: string;
  email: string;
  phone: string;
  content: string;
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
  constructor(
    private readonly database: DatabaseService,
    private readonly smtp: SmtpService,
  ) {}

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
    const [interactions, followups, emails, history] = await Promise.all([
      this.database.query(
        'SELECT i.id,i.actor_id,i.channel,i.content,i.created_at FROM response_interactions i WHERE response_id=$1 ORDER BY created_at',
        [id],
      ),
      this.database.query(
        'SELECT id,due_at,attempt,status,note,channel,goal,reminder_minutes,wait_days,max_attempts,interval_days,completed_at FROM followups WHERE response_id=$1 ORDER BY attempt',
        [id],
      ),
      this.database.query(
        'SELECT id,state,subject,created_at,sent_at,error FROM response_email_deliveries WHERE response_id=$1 ORDER BY id DESC',
        [id],
      ),
      this.database.query(
        'SELECT actor_id,from_status,to_status,changed_at FROM response_status_history WHERE response_id=$1 ORDER BY changed_at',
        [id],
      ),
    ]);
    return {
      ...item,
      interactions: interactions.rows,
      followups: followups.rows,
      email_deliveries: emails.rows,
      status_history: history.rows,
    };
  }

  @Post(':id/reply')
  @Roles('employee')
  async reply(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { senderAccountId?: unknown; subject?: unknown; content?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const subject =
      typeof body?.subject === 'string' ? body.subject.trim() : '';
    const content =
      typeof body?.content === 'string' ? body.content.trim() : '';
    if (
      !Number.isSafeInteger(body?.senderAccountId) ||
      Number(body.senderAccountId) < 1 ||
      !subject ||
      subject.length > 150 ||
      !content ||
      content.length > 100000
    )
      throw new BadRequestException(
        'Tài khoản gửi, tiêu đề và nội dung email là bắt buộc.',
      );
    const client = await this.database.connect();
    let account: (SmtpAccount & { id: string }) | undefined;
    let recipient = '';
    let deliveryId = '';
    try {
      await client.query('BEGIN');
      const item = await client.query<ResponseRow & { email: string }>(
        'SELECT * FROM responses WHERE id=$1 AND assignee_id=$2 AND hidden_at IS NULL FOR UPDATE',
        [id, request.account.id],
      );
      if (!item.rows[0]) throw new NotFoundException();
      if (['unsubscribe', 'spam', 'bounce'].includes(item.rows[0].kind))
        throw new ConflictException(
          'Không thể gửi email tới Response từ chối, rác hoặc email bị trả lại.',
        );
      recipient = item.rows[0].email;
      if (!recipient)
        throw new ConflictException(
          'Response chưa có địa chỉ email. Bổ sung email trước khi gửi.',
        );
      const suppressed = await client.query(
        'SELECT 1 FROM email_suppressions WHERE email=lower($1)',
        [recipient],
      );
      if (suppressed.rowCount)
        throw new ConflictException('Địa chỉ email đã bị chặn nhận thư.');
      const sender = await client.query<
        SmtpAccount & { id: string; quota_3_days: number } & QueryResultRow
      >(
        "SELECT * FROM sender_accounts WHERE id=$1 AND status='active' AND smtp_secret IS NOT NULL FOR UPDATE",
        [body.senderAccountId],
      );
      account = sender.rows[0];
      if (!account)
        throw new ConflictException(
          'Tài khoản gửi chưa hoạt động hoặc chưa cấu hình SMTP.',
        );
      const usage = await client.query<{ used: string }>(
        `SELECT (SELECT count(*) FROM email_deliveries WHERE sender_account_id=$1 AND state IN ('sending','sent') AND created_at>now()-interval '3 days')
         +(SELECT count(*) FROM response_email_deliveries WHERE sender_account_id=$1 AND state IN ('sending','sent') AND created_at>now()-interval '3 days') AS used`,
        [account.id],
      );
      if (Number(usage.rows[0].used) >= sender.rows[0].quota_3_days)
        throw new ConflictException('Tài khoản gửi đã đạt hạn mức 3 ngày.');
      const saved = await client.query<{ id: string }>(
        "INSERT INTO response_email_deliveries(response_id,sender_account_id,actor_id,subject,content,state) VALUES($1,$2,$3,$4,$5,'sending') RETURNING id",
        [id, account.id, request.account.id, subject, content],
      );
      deliveryId = saved.rows[0].id;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException(
          'Email trước đang gửi hoặc chưa rõ trạng thái. Kiểm tra hộp thư trước khi thử lại.',
        );
      throw error;
    } finally {
      client.release();
    }
    try {
      const messageId = await this.smtp.send(
        account,
        recipient,
        subject,
        content,
      );
      const result = await this.database.connect();
      try {
        await result.query('BEGIN');
        await result.query(
          "UPDATE response_email_deliveries SET state='sent',sent_at=now(),provider_message_id=$2 WHERE id=$1 AND state='sending'",
          [deliveryId, messageId],
        );
        await result.query(
          "INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,$2,'email',$3)",
          [id, request.account.id, content],
        );
        const previous = await result.query<
          { status: string } & QueryResultRow
        >('SELECT status FROM responses WHERE id=$1 FOR UPDATE', [id]);
        await result.query(
          "UPDATE responses SET status='replied',updated_at=now() WHERE id=$1 AND status IN ('new','processing')",
          [id],
        );
        if (['new', 'processing'].includes(previous.rows[0].status))
          await result.query(
            'INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,$2,$3,$4)',
            [id, request.account.id, previous.rows[0].status, 'replied'],
          );
        await result.query('COMMIT');
      } catch (error) {
        await result.query('ROLLBACK');
        throw error;
      } finally {
        result.release();
      }
      return { sent: true, messageId };
    } catch {
      // shortcut: SMTP acceptance can be uncertain; keep 'sending' for manual review instead of risking a duplicate retry.
      throw new ServiceUnavailableException(
        'Chưa xác định email đã gửi hay chưa. Kiểm tra hộp thư trước khi thử lại.',
      );
    }
  }

  @Post()
  @Roles('employee')
  async create(
    @Body()
    body: {
      customerName?: unknown;
      email?: unknown;
      phone?: unknown;
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
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const content =
      typeof body?.content === 'string' ? body.content.trim() : '';
    if (
      !name ||
      name.length > 200 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      email.length > 320 ||
      (phone && !/^[0-9+\s().-]{9,20}$/.test(phone)) ||
      (body.kind !== undefined &&
        (typeof body.kind !== 'string' || !kinds.includes(body.kind))) ||
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
    const contact = email
      ? await this.database.query<{ id: string } & QueryResultRow>(
          'SELECT id FROM contacts WHERE lower(email)=$1',
          [email],
        )
      : { rows: [] };
    const result = await this.database.query<ResponseRow>(
      `INSERT INTO responses(campaign_id,contact_id,customer_name,email,phone,kind,assignee_id,content)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        campaignId,
        contact.rows[0]?.id ?? null,
        name,
        email,
        phone,
        body.kind ?? 'other',
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
    @Body()
    body: {
      customerName?: unknown;
      email?: unknown;
      phone?: unknown;
      kind?: unknown;
      status?: unknown;
      content?: unknown;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    const item = await this.one(id, request);
    if (item.assignee_id !== request.account.id) throw new NotFoundException();
    const kind = body?.kind === undefined ? item.kind : body.kind;
    const status = body?.status === undefined ? item.status : body.status;
    const content = body?.content === undefined ? item.content : body.content;
    const customerName =
      body?.customerName === undefined
        ? item.customer_name
        : typeof body.customerName === 'string'
          ? body.customerName.trim()
          : '';
    const email =
      body?.email === undefined
        ? item.email
        : typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : '';
    const phone =
      body?.phone === undefined
        ? item.phone
        : typeof body.phone === 'string'
          ? body.phone.trim()
          : '';
    if (
      !customerName ||
      customerName.length > 200 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      email.length > 320 ||
      (phone && !/^[0-9+\s().-]{9,20}$/.test(phone)) ||
      typeof kind !== 'string' ||
      !kinds.includes(kind) ||
      typeof status !== 'string' ||
      !statuses.includes(status) ||
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > 100000
    )
      throw new BadRequestException('Dữ liệu Response không hợp lệ.');
    const nextStatus: Record<string, string> = {
      new: 'processing',
      processing: 'replied',
      replied: 'closed',
    };
    if (status !== item.status && nextStatus[item.status] !== status)
      throw new ConflictException('Chuyển trạng thái không đúng quy trình.');
    if (
      !['new', 'processing'].includes(item.status) &&
      (status === item.status ||
        kind !== item.kind ||
        content.trim() !== item.content ||
        customerName !== item.customer_name ||
        email !== item.email ||
        phone !== item.phone)
    )
      throw new ConflictException(
        'Response đã phản hồi chỉ được chốt nhu cầu.',
      );
    const client = await this.database.connect();
    let saved: ResponseRow;
    try {
      await client.query('BEGIN');
      const contact = email
        ? await client.query<{ id: string } & QueryResultRow>(
            'SELECT id FROM contacts WHERE lower(email)=$1',
            [email],
          )
        : { rows: [] };
      const result = await client.query<ResponseRow>(
        'UPDATE responses SET kind=$2,status=$3,content=$4,customer_name=$5,email=$6,phone=$7,contact_id=$8,updated_at=now() WHERE id=$1 AND assignee_id=$9 AND status=$10 RETURNING *',
        [
          id,
          kind,
          status,
          content.trim(),
          customerName,
          email,
          phone,
          contact.rows[0]?.id ?? null,
          request.account.id,
          item.status,
        ],
      );
      if (!result.rows[0])
        throw new ConflictException('Response đã đổi trạng thái.');
      saved = result.rows[0];
      if (status !== item.status)
        await client.query(
          'INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,$2,$3,$4)',
          [id, request.account.id, item.status, status],
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await this.applySuppression(saved);
    return saved;
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
      !['sms', 'note'].includes(String(body?.channel)) ||
      typeof body?.content !== 'string' ||
      !body.content.trim() ||
      body.content.length > 100000
    )
      throw new BadRequestException('Nội dung tương tác không hợp lệ.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ status: string } & QueryResultRow>(
        'SELECT status FROM responses WHERE id=$1 AND assignee_id=$2 FOR UPDATE',
        [id, request.account.id],
      );
      if (!current.rows[0]) throw new NotFoundException();
      const result = await client.query<
        {
          id: string;
          channel: string;
          content: string;
          created_at: Date;
        } & QueryResultRow
      >(
        'INSERT INTO response_interactions(response_id,actor_id,channel,content) VALUES($1,$2,$3,$4) RETURNING *',
        [id, request.account.id, body.channel, body.content.trim()],
      );
      if (
        body.channel === 'sms' &&
        ['new', 'processing'].includes(current.rows[0].status)
      ) {
        await client.query(
          "UPDATE responses SET status='replied',updated_at=now() WHERE id=$1",
          [id],
        );
        await client.query(
          'INSERT INTO response_status_history(response_id,actor_id,from_status,to_status) VALUES($1,$2,$3,$4)',
          [id, request.account.id, current.rows[0].status, 'replied'],
        );
      }
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
