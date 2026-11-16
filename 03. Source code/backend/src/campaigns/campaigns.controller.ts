import { dailyQuotaStartSql } from '../senders/daily-quota';
import { createHash } from 'node:crypto';
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
import { ConfigService } from '@nestjs/config';
import { Roles } from '../auth/roles';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import { DeliveryWorker } from './delivery.worker';
import { parseCampaignBody } from './content-blocks';
import { SmtpService, type SmtpAccount } from '../senders/smtp.service';
import type { PoolClient } from 'pg';

const variables = ['{{Họ tên}}', '{{Tên doanh nghiệp}}'];
function inSendWindow(start: Date, from: string, to: string) {
  const time = `${String((start.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`;
  return time >= from.slice(0, 5) && time < to.slice(0, 5);
}
export function fill(
  value: string,
  name: string | null,
  company: string | null,
): string {
  return value
    .replaceAll(variables[0], name?.trim() || variables[0])
    .replaceAll(variables[1], company?.trim() || variables[1]);
}

type Campaign = QueryResultRow & {
  id: string;
  review_list_id: string | null;
  owner_id: string;
  name: string;
  status: string;
  sent_count: number;
  subject: string | null;
  body: string | null;
  sender_account_id: string | null;
  scheduled_at: Date | null;
  send_mode: string;
};
type CreateInput = {
  name?: unknown;
  description?: unknown;
  listIds?: unknown;
  campaignId?: unknown;
};
type ContentInput = {
  subject?: unknown;
  body?: unknown;
  requirePreview?: unknown;
};

@Controller('api/campaigns')
@UseGuards(SessionGuard)
export class CampaignsController {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
    private readonly delivery: DeliveryWorker,
    private readonly smtp: SmtpService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT c.id,c.name,c.description,c.subject,c.body,c.status,c.owner_id,c.sender_account_id,c.sender_name,c.needs_reconfirmation,c.filter_summary,c.scheduled_at,c.send_mode,c.send_rate,c.window_start,c.window_end,c.sent_count,c.paused_at,c.pause_reason,c.created_at,c.manager_comment,c.reviewed_at,c.reviewed_by,
       (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id=c.id) AS recipient_count,
       (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id=c.id AND r.status='pending') AS pending_count
       FROM campaigns c WHERE $1='manager' OR c.owner_id=$2 ORDER BY c.created_at DESC LIMIT 100`,
      [request.account.role, request.account.id],
    );
    return result.rows;
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.one(id, request);
    const [lists, recipients] = await Promise.all([
      this.database.query(
        'SELECT l.id,l.name,l.reviewed_at,l.reviewed_by,l.manager_review FROM contact_lists l JOIN campaign_lists cl ON cl.list_id=l.id WHERE cl.campaign_id=$1',
        [id],
      ),
      this.database.query(
        `SELECT c.id,c.full_name,c.email,r.status,r.sent_at,r.error FROM campaign_recipients r JOIN contacts c ON c.id=r.contact_id WHERE r.campaign_id=$1 ORDER BY c.id LIMIT 1000`,
        [id],
      ),
    ]);
    return { ...campaign, lists: lists.rows, recipients: recipients.rows };
  }

  @Post('recipients/filter')
  @Roles('employee')
  async filterRecipients(
    @Body() body: CreateInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const client = await this.database.connect();
    try {
      return await this.filteredRecipients(client, body, request);
    } finally {
      client.release();
    }
  }

  @Post()
  @Roles('employee')
  async create(
    @Body() body: CreateInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const filtered = await this.filteredRecipients(client, body, request);
      if (!filtered.filter_summary.valid)
        throw new ConflictException({
          message: 'Không còn người nhận hợp lệ sau khi lọc.',
          filter: filtered.filter_summary,
        });
      let campaign: Campaign;
      if (body.campaignId !== undefined) {
        if (
          !Number.isSafeInteger(body.campaignId) ||
          Number(body.campaignId) < 1
        )
          throw new BadRequestException('Chiến dịch không hợp lệ.');
        const existing = await client.query<Campaign>(
          "SELECT * FROM campaigns WHERE id=$1 AND owner_id=$2 AND status='rejected' FOR UPDATE",
          [body.campaignId, request.account.id],
        );
        if (!existing.rows[0])
          throw new ConflictException(
            'Chỉ chọn lại người nhận cho chiến dịch có danh sách không đạt.',
          );
        campaign = existing.rows[0];
        await client.query(
          'DELETE FROM campaign_recipients WHERE campaign_id=$1',
          [campaign.id],
        );
        await client.query('DELETE FROM campaign_lists WHERE campaign_id=$1', [
          campaign.id,
        ]);
        await client.query('DELETE FROM contact_list_items WHERE list_id=$1', [
          campaign.review_list_id,
        ]);
        await client.query(
          "UPDATE contact_lists SET name=$2,manager_review='pending',manager_comment=NULL,reviewed_at=NULL,reviewed_by=NULL,confirmed_at=now() WHERE id=$1",
          [campaign.review_list_id, filtered.name],
        );
      } else {
        const created = await client.query<Campaign>(
          "INSERT INTO campaigns(name,description,owner_id,status) VALUES($1,$2,$3,'pending_approval') RETURNING *",
          [filtered.name, filtered.description, request.account.id],
        );
        campaign = created.rows[0];
      }
      let reviewListId = campaign.review_list_id;
      if (!reviewListId) {
        const review = await client.query<{ id: string }>(
          "INSERT INTO contact_lists(name,owner_id,employee_review,confirmed_at) VALUES($1,$2,'passed',now()) RETURNING id",
          [filtered.name, request.account.id],
        );
        reviewListId = review.rows[0].id;
      }
      await client.query(
        'INSERT INTO campaign_lists(campaign_id,list_id) SELECT $1::bigint,unnest($2::bigint[])',
        [campaign.id, body.listIds],
      );
      const contactIds = filtered.recipients.map((contact) => contact.id);
      await client.query(
        'INSERT INTO campaign_recipients(campaign_id,contact_id) SELECT $1::bigint,unnest($2::bigint[])',
        [campaign.id, contactIds],
      );
      await client.query(
        'INSERT INTO contact_list_items(list_id,contact_id) SELECT $1::bigint,unnest($2::bigint[])',
        [reviewListId, contactIds],
      );
      const saved = await client.query<Campaign>(
        "UPDATE campaigns SET name=$2,description=$3,status='pending_approval',review_list_id=$4,filter_summary=$5,manager_comment=NULL,reviewed_at=NULL,reviewed_by=NULL,updated_at=now() WHERE id=$1 RETURNING *",
        [
          campaign.id,
          filtered.name,
          filtered.description,
          reviewListId,
          filtered.filter_summary,
        ],
      );
      await client.query('COMMIT');
      return {
        ...saved.rows[0],
        recipient_count: contactIds.length,
        pending_count: contactIds.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException('Tên chiến dịch đã được sử dụng.');
      throw error;
    } finally {
      client.release();
    }
  }

  private async filteredRecipients(
    client: Pick<PoolClient, 'query'>,
    body: CreateInput,
    request: AuthenticatedRequest,
  ) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = body?.description ?? null;
    const listIds = body?.listIds;
    if (
      !name ||
      name.length > 100 ||
      (description !== null &&
        (typeof description !== 'string' || description.length > 2000)) ||
      !Array.isArray(listIds) ||
      !listIds.length ||
      listIds.length > 20 ||
      !listIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
      new Set(listIds).size !== listIds.length
    )
      throw new BadRequestException(
        'Tên chiến dịch hoặc danh sách Contact không hợp lệ.',
      );
    const lists = await client.query(
      `SELECT l.id,l.name FROM contact_lists l WHERE l.id=ANY($1::bigint[]) AND l.owner_id=$2 AND l.confirmed_at IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM campaigns c WHERE c.review_list_id=l.id) FOR SHARE`,
      [listIds, request.account.id],
    );
    if (lists.rowCount !== listIds.length)
      throw new ConflictException(
        'Chỉ chọn danh sách đã được nhân viên xác nhận.',
      );
    const result = await client.query<{
      id: string;
      email: string;
      full_name: string | null;
      company: string | null;
      unsubscribed_at: Date | null;
      suppressed: boolean;
    }>(
      `SELECT c.id,c.email,c.full_name,c.company,c.unsubscribed_at,
        EXISTS(SELECT 1 FROM email_suppressions s WHERE s.email=lower(c.email)) AS suppressed
       FROM contacts c JOIN contact_list_items i ON i.contact_id=c.id WHERE i.list_id=ANY($1::bigint[]) ORDER BY i.list_id,c.id`,
      [listIds],
    );
    const seen = new Set<string>();
    const filter = {
      original: result.rows.length,
      duplicate: 0,
      invalid: 0,
      unsubscribe: 0,
      valid: 0,
      excluded: 0,
    };
    const recipients = result.rows.filter((contact) => {
      const email = String(contact.email || '')
        .trim()
        .toLowerCase();
      if (seen.has(email)) {
        filter.duplicate++;
        return false;
      }
      seen.add(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        filter.invalid++;
        return false;
      }
      if (contact.unsubscribed_at || contact.suppressed) {
        filter.unsubscribe++;
        return false;
      }
      return true;
    });
    filter.valid = recipients.length;
    filter.excluded = filter.original - filter.valid;
    return {
      name,
      description,
      lists: lists.rows,
      recipients,
      recipient_count: recipients.length,
      filter_summary: filter,
    };
  }

  @Post(':id/recipients/confirm')
  @Roles('employee')
  async confirmRecipients(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    if (campaign.status !== 'pending_approval')
      throw new ConflictException('Danh sách không ở trạng thái chờ kiểm tra.');
    return campaign;
  }

  @Patch(':id')
  @Roles('employee')
  async updateDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: unknown; description?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const current = await this.owned(id, request);
    if (
      current.status === 'scheduled' &&
      current.scheduled_at &&
      new Date(current.scheduled_at).getTime() < Date.now() + 15 * 60000
    )
      throw new ConflictException(
        'Không thể chỉnh sửa chiến dịch trước giờ gửi dưới 15 phút.',
      );
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() : '';
    if (!name || name.length > 100 || description.length > 2000)
      throw new BadRequestException(
        'Tên chiến dịch là bắt buộc, tối đa 100 ký tự; mô tả tối đa 2000 ký tự.',
      );
    try {
      const result = await this.database.query<Campaign>(
        "UPDATE campaigns SET name=$2,description=$3,updated_at=now() WHERE id=$1 AND owner_id=$4 AND status IN ('approved','scheduled','paused') RETURNING *",
        [id, name, description, request.account.id],
      );
      if (!result.rows[0])
        throw new ConflictException(
          'Chiến dịch không thể chỉnh sửa thông tin chung.',
        );
      return result.rows[0];
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException('Tên chiến dịch đã được sử dụng.');
      throw error;
    }
  }

  @Patch(':id/content')
  @Roles('employee')
  async content(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ContentInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign, true);
    if (
      body?.requirePreview !== undefined &&
      typeof body.requirePreview !== 'boolean'
    )
      throw new BadRequestException('Thông tin xem trước không hợp lệ.');
    const { subject, content } = await this.checkedContent(id, body);
    const result = await this.database.query(
      "UPDATE campaigns SET status=CASE WHEN status='scheduled' THEN 'approved' ELSE status END,subject=$2,body=$3,previewed_at=CASE WHEN preview_draft_hash=$4 THEN now() ELSE NULL END,preview_draft_hash=NULL,needs_reconfirmation=(status='paused'),updated_at=now() WHERE id=$1 AND status IN ('approved','paused','scheduled') AND (NOT $5::boolean OR preview_draft_hash=$4) RETURNING *",
      [
        id,
        subject,
        content,
        createHash('sha256')
          .update(JSON.stringify([subject, content]))
          .digest('hex'),
        body.requirePreview === true,
      ],
    );
    if (!result.rows[0])
      throw new ConflictException(
        'Chiến dịch hoặc nội dung đã thay đổi. Vui lòng xem trước lại trước khi lưu.',
      );
    return result.rows[0];
  }

  @Post(':id/preview')
  @Roles('employee')
  async preview(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { contactId?: unknown; subject?: unknown; body?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign, true);
    if (
      body?.contactId !== undefined &&
      (!Number.isSafeInteger(body.contactId) || Number(body.contactId) < 1)
    )
      throw new BadRequestException('Contact xem trước không hợp lệ.');
    const draft = body?.subject !== undefined || body?.body !== undefined;
    const value = draft
      ? await this.checkedContent(id, body, true)
      : { subject: campaign.subject, content: campaign.body };
    if (!value.subject || !value.content)
      throw new ConflictException('Chưa có nội dung email.');
    const contact = await this.database.query<
      {
        id: string;
        full_name: string | null;
        company: string | null;
      } & QueryResultRow
    >(
      `SELECT c.id,c.full_name,c.company FROM contacts c JOIN campaign_recipients r ON r.contact_id=c.id
       WHERE r.campaign_id=$1 AND ($2::bigint IS NULL OR c.id=$2) ORDER BY c.id LIMIT 1`,
      [id, Number.isSafeInteger(body?.contactId) ? body.contactId : null],
    );
    if (!contact.rows[0])
      throw new NotFoundException('Không tìm thấy Contact xem trước.');
    const variableErrors = [
      ...new Set(
        (value.subject + '\n' + value.content).match(
          /\{\{[^{}]*\}\}|\{\{[^}\n]*|[^{}\n]*\}\}/g,
        ) || [],
      ),
    ].filter((token) => !variables.includes(token));
    if (variableErrors.length)
      await this.database.query(
        'UPDATE campaigns SET preview_draft_hash=NULL,previewed_at=NULL WHERE id=$1',
        [id],
      );
    if (draft && !variableErrors.length)
      await this.database.query(
        'UPDATE campaigns SET preview_draft_hash=$2 WHERE id=$1',
        [
          id,
          createHash('sha256')
            .update(JSON.stringify([value.subject, value.content]))
            .digest('hex'),
        ],
      );
    else if (!draft && !variableErrors.length)
      await this.database.query(
        "UPDATE campaigns SET previewed_at=now() WHERE id=$1 AND status IN ('approved','paused')",
        [id],
      );
    const assets = await this.database.query(
      'SELECT id,kind,file_name,content_type,size_bytes FROM campaign_assets WHERE campaign_id=$1 ORDER BY id',
      [id],
    );
    return {
      variable_errors: variableErrors,
      contact_id: contact.rows[0].id,
      assets: assets.rows,
      subject: fill(
        value.subject,
        contact.rows[0].full_name,
        contact.rows[0].company,
      ),
      body: fill(
        value.content,
        contact.rows[0].full_name,
        contact.rows[0].company,
      ),
    };
  }

  @Post(':id/sender-check')
  @Roles('employee')
  async checkSender(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { senderAccountId?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign, true);
    if (
      !Number.isSafeInteger(body?.senderAccountId) ||
      Number(body.senderAccountId) < 1
    )
      throw new BadRequestException('Tài khoản gửi không hợp lệ.');
    await this.ensureSenderCapacity(Number(body.senderAccountId), id);
    await this.verifySender(Number(body.senderAccountId));
    return { connected: true };
  }

  private async verifySender(id: number) {
    const result = await this.database.query<SmtpAccount & QueryResultRow>(
      "SELECT * FROM sender_accounts WHERE id=$1 AND status='active'",
      [id],
    );
    if (!result.rows[0])
      throw new ConflictException('Tài khoản gửi không còn hoạt động.');
    try {
      await this.smtp.verify(result.rows[0]);
    } catch {
      throw new ConflictException(
        'Không kết nối được máy chủ email. Kiểm tra tài khoản gửi và thử lại.',
      );
    }
  }

  @Patch(':id/sender')
  @Roles('employee')
  async sender(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { senderAccountId?: unknown; senderName?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign, true);
    if (
      body?.senderName !== undefined &&
      (typeof body.senderName !== 'string' ||
        !body.senderName.trim() ||
        body.senderName.trim().length > 50 ||
        /[\r\n]/.test(body.senderName))
    )
      throw new BadRequestException(
        'Vui lòng nhập tên người gửi, tối đa 50 ký tự.',
      );
    if (
      !Number.isSafeInteger(body?.senderAccountId) ||
      Number(body.senderAccountId) < 1
    )
      throw new BadRequestException('Tài khoản gửi không hợp lệ.');
    const sender = await this.database.query(
      "SELECT id FROM sender_accounts WHERE id=$1 AND status='active' AND ((google_refresh_secret IS NOT NULL AND google_status='connected') OR (google_refresh_secret IS NULL AND smtp_secret IS NOT NULL))",
      [body.senderAccountId],
    );
    if (!sender.rowCount)
      throw new ConflictException(
        'Tài khoản gửi chưa hoạt động hoặc chưa cấu hình SMTP.',
      );
    await this.ensureSenderCapacity(Number(body.senderAccountId), id);
    await this.verifySender(Number(body.senderAccountId));
    const result = await this.database.query(
      "UPDATE campaigns SET status=CASE WHEN status='scheduled' THEN 'approved' ELSE status END,sender_account_id=$2,sender_name=COALESCE($3,(SELECT name FROM sender_accounts WHERE id=$2)),needs_reconfirmation=(status='paused'),updated_at=now() WHERE id=$1 AND status IN ('approved','paused','scheduled') RETURNING *",
      [
        id,
        body.senderAccountId,
        typeof body.senderName === 'string' ? body.senderName.trim() : null,
      ],
    );
    if (!result.rows[0])
      throw new ConflictException('Chiến dịch đã đổi trạng thái.');
    return result.rows[0];
  }

  @Patch(':id/schedule')
  @Roles('employee')
  async schedule(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      scheduledAt?: unknown;
      sendNow?: unknown;
      rate?: unknown;
      windowStart?: unknown;
      windowEnd?: unknown;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign, true);
    const sendNow = body?.sendNow === true;
    const requestedRate = body.rate ?? 50;
    const windowStart = body.windowStart ?? '08:00';
    const windowEnd = body.windowEnd ?? '17:00';
    if (
      !Number.isInteger(requestedRate) ||
      Number(requestedRate) < 1 ||
      Number(requestedRate) > 100 ||
      typeof windowStart !== 'string' ||
      typeof windowEnd !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(windowStart) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(windowEnd) ||
      windowStart >= windowEnd
    )
      throw new BadRequestException(
        'Tốc độ gửi từ 1 đến 100 email/giờ; khung giờ bắt đầu phải trước giờ kết thúc.',
      );
    if (!sendNow && typeof body?.scheduledAt !== 'string')
      throw new BadRequestException('Thời điểm gửi không hợp lệ.');
    const date = sendNow ? new Date() : new Date(body.scheduledAt as string);
    if (
      !sendNow &&
      (!Number.isFinite(date.getTime()) ||
        date.getTime() < Date.now() + 15 * 60000 ||
        date.getTime() > Date.now() + 90 * 86400000)
    )
      throw new BadRequestException(
        'Lịch gửi phải từ 15 phút đến 90 ngày sau hiện tại.',
      );
    if (!sendNow && !inSendWindow(date, windowStart, windowEnd))
      throw new BadRequestException(
        'Giờ bắt đầu phải nằm trong khung giờ gửi.',
      );
    const senderLimit = await this.database.query<{ quota_hourly: number }>(
      'SELECT quota_hourly FROM sender_accounts WHERE id=$1',
      [campaign.sender_account_id],
    );
    const rate = Math.min(
      Number(requestedRate),
      senderLimit.rows[0]?.quota_hourly ?? Number(requestedRate),
    );
    const result = await this.database.query(
      "UPDATE campaigns SET status=CASE WHEN status='scheduled' THEN 'approved' ELSE status END,needs_reconfirmation=(status='paused'),scheduled_at=$2,send_mode=$3,send_rate=$4,window_start=$5,window_end=$6,updated_at=now() WHERE id=$1 AND status IN ('approved','paused','scheduled') RETURNING *",
      [id, date, sendNow ? 'now' : 'scheduled', rate, windowStart, windowEnd],
    );
    if (!result.rows[0])
      throw new ConflictException('Chiến dịch đã đổi trạng thái.');
    return result.rows[0];
  }

  @Post(':id/confirm')
  @Roles('employee')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign);
    if (
      campaign.send_mode !== 'now' &&
      (!campaign.scheduled_at ||
        new Date(campaign.scheduled_at).getTime() < Date.now() + 15 * 60000)
    )
      throw new ConflictException(
        'Lịch gửi không còn hợp lệ. Điều chỉnh thời điểm bắt đầu tối thiểu 15 phút sau hiện tại.',
      );
    if (
      campaign.send_mode !== 'now' &&
      !inSendWindow(
        new Date(campaign.scheduled_at!),
        String(campaign.window_start || '08:00'),
        String(campaign.window_end || '17:00'),
      )
    )
      throw new ConflictException(
        'Lịch gửi không còn phù hợp với khung giờ gửi. Vui lòng điều chỉnh lại.',
      );
    const preview = await this.database.query(
      'SELECT previewed_at FROM campaigns WHERE id=$1',
      [id],
    );
    if (
      !campaign.subject ||
      !campaign.body ||
      !campaign.sender_account_id ||
      !campaign.scheduled_at ||
      !preview.rows[0]?.previewed_at
    )
      throw new ConflictException(
        'Cần hoàn tất nội dung, xem trước, tài khoản và lịch gửi.',
      );
    if (!this.config.get<string>('PUBLIC_BASE_URL'))
      throw new ConflictException(
        'Máy chủ chưa có địa chỉ công khai cho liên kết ngừng nhận email.',
      );
    const account = await this.database.query(
      "SELECT 1 FROM sender_accounts WHERE id=$1 AND status='active' AND ((google_refresh_secret IS NOT NULL AND google_status='connected') OR (google_refresh_secret IS NULL AND smtp_secret IS NOT NULL))",
      [campaign.sender_account_id],
    );
    if (!account.rowCount)
      throw new ConflictException('Tài khoản gửi không còn hoạt động.');
    await this.ensureSenderCapacity(Number(campaign.sender_account_id), id);
    const result = await this.database.query(
      `UPDATE campaigns SET status='scheduled',scheduled_at=CASE WHEN send_mode='now' THEN now() ELSE scheduled_at END,updated_at=now() WHERE id=$1 AND status='approved' AND EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1) RETURNING *`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Chiến dịch chưa sẵn sàng xác nhận.');
    if (campaign.send_mode === 'now') void this.delivery.tick();
    return result.rows[0];
  }

  @Post(':id/pause')
  @Roles('employee', 'manager')
  async pause(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: unknown },
    @Req() request: AuthenticatedRequest,
  ) {
    await this.one(id, request);
    const reason =
      body?.reason === undefined
        ? null
        : typeof body.reason === 'string'
          ? body.reason.trim()
          : undefined;
    if (reason === undefined || (reason && reason.length > 250))
      throw new BadRequestException('Lý do tạm dừng tối đa 250 ký tự.');
    const result = await this.database.query(
      `UPDATE campaigns SET status='paused',paused_at=now(),pause_reason=$2,updated_at=now() WHERE id=$1 AND status IN ('scheduled','sending') RETURNING *`,
      [id, reason || null],
    );
    if (!result.rowCount)
      throw new ConflictException('Chiến dịch không thể tạm dừng.');
    return result.rows[0];
  }

  @Post(':id/resume')
  @Roles('employee', 'manager')
  async resume(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.one(id, request);
    if (campaign.status === 'paused') {
      if (!campaign.sender_account_id)
        throw new ConflictException(
          'Cần chọn tài khoản gửi trước khi tiếp tục.',
        );
      await this.ensureSenderCapacity(Number(campaign.sender_account_id), id);
    }
    const result = await this.database.query(
      `UPDATE campaigns SET needs_reconfirmation=false,status='scheduled',send_mode='scheduled',scheduled_at=now()+interval '15 minutes',updated_at=now() WHERE id=$1 AND status='paused' AND previewed_at IS NOT NULL AND EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1 AND status='pending') AND NOT EXISTS(SELECT 1 FROM email_deliveries WHERE campaign_id=$1 AND state='sending') RETURNING *`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Không còn email chưa gửi để tiếp tục.');
    return result.rows[0];
  }

  @Delete(':id')
  @Roles('employee')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.owned(id, request);
    const result = await this.database.query(
      `WITH deleted AS (
        DELETE FROM campaigns WHERE id=$1 AND status IN ('draft','pending_approval','rejected','approved','scheduled','paused')
        AND sent_count=0 AND NOT EXISTS(SELECT 1 FROM email_deliveries WHERE campaign_id=$1) RETURNING id,review_list_id
      ), removed_review AS (
        DELETE FROM contact_lists l USING deleted d WHERE l.id=d.review_list_id RETURNING l.id
      ) SELECT id FROM deleted`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException(
        'Không thể xóa chiến dịch đã gửi email hoặc đang gửi.',
      );
    return { deleted: true };
  }

  private async checkedContent(
    id: number,
    body: ContentInput,
    preview = false,
  ) {
    const subject =
      typeof body?.subject === 'string' ? body.subject.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (
      !subject ||
      subject.length > 150 ||
      subject.includes('[[') ||
      subject.includes(']]') ||
      !content ||
      content.length > 100000
    )
      throw new BadRequestException(
        'Tiêu đề hoặc nội dung email không hợp lệ.',
      );
    const unsupported = (subject + content)
      .match(/\{\{[^{}]*\}\}/g)
      ?.filter((item) => !variables.includes(item));
    if (!preview && unsupported?.length)
      throw new BadRequestException('Biến cá nhân hóa không được hỗ trợ.');
    if (
      !preview &&
      /\{\{|\}\}/.test((subject + content).replace(/\{\{[^{}]*\}\}/g, ''))
    )
      throw new BadRequestException('Biến cá nhân hóa sai cú pháp.');
    const imageIds = [
      ...new Set(
        parseCampaignBody(content)
          .filter((block) => block.kind === 'image')
          .map((block) => block.id),
      ),
    ];
    if (imageIds.length) {
      const images = await this.database.query(
        "SELECT id FROM campaign_assets WHERE campaign_id=$1 AND kind='image' AND id=ANY($2::bigint[])",
        [id, imageIds],
      );
      if (images.rowCount !== imageIds.length)
        throw new BadRequestException(
          'Ảnh trong nội dung email không còn tồn tại.',
        );
    }
    return { subject, content };
  }

  private async one(
    id: number,
    request: AuthenticatedRequest,
  ): Promise<Campaign> {
    const result = await this.database.query<Campaign>(
      "SELECT campaigns.*,(SELECT count(*)::int FROM campaign_recipients WHERE campaign_id=campaigns.id) AS recipient_count,(SELECT count(*)::int FROM campaign_recipients WHERE campaign_id=campaigns.id AND status='pending') AS pending_count FROM campaigns WHERE id=$1 AND ($2='manager' OR owner_id=$3)",
      [id, request.account.role, request.account.id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  private async owned(
    id: number,
    request: AuthenticatedRequest,
  ): Promise<Campaign> {
    const campaign = await this.one(id, request);
    if (campaign.owner_id !== request.account.id) throw new NotFoundException();
    return campaign;
  }

  private async ensureSenderCapacity(senderId: number, campaignId: number) {
    const result = await this.database.query<{
      remaining: string;
      pending: string;
      quota: number;
    }>(
      `SELECT s.quota_3_days AS quota,s.quota_3_days
        - (SELECT count(*) FROM email_deliveries d WHERE d.sender_account_id=s.id AND d.state IN ('sent','sending') AND (d.state='sending' OR COALESCE(d.sent_at,d.created_at)>=${dailyQuotaStartSql}))
        - (SELECT count(*) FROM response_email_deliveries r WHERE r.sender_account_id=s.id AND r.state IN ('sent','sending') AND (r.state='sending' OR COALESCE(r.sent_at,r.created_at)>=${dailyQuotaStartSql})) AS remaining,
        (SELECT count(*) FROM campaign_recipients WHERE campaign_id=$2 AND status='pending') AS pending
       FROM sender_accounts s WHERE s.id=$1 AND s.status='active' AND ((s.google_refresh_secret IS NOT NULL AND s.google_status='connected') OR (s.google_refresh_secret IS NULL AND s.smtp_secret IS NOT NULL))`,
      [senderId, campaignId],
    );
    if (!result.rows[0])
      throw new ConflictException('Tài khoản gửi không còn hoạt động.');
    if (Number(result.rows[0].remaining) <= Number(result.rows[0].quota) * 0.2)
      throw new ConflictException('Tài khoản đã dùng từ 80% hạn mức ngày.');
    if (Number(result.rows[0].remaining) < Number(result.rows[0].pending))
      throw new ConflictException(
        'Tài khoản gửi không đủ hạn mức cho số email còn lại.',
      );
  }

  private editable(campaign: Campaign, allowPaused = false) {
    if (
      campaign.status !== 'approved' &&
      !(
        allowPaused &&
        (campaign.status === 'paused' ||
          (campaign.status === 'scheduled' &&
            campaign.scheduled_at &&
            new Date(campaign.scheduled_at).getTime() >=
              Date.now() + 15 * 60000))
      )
    )
      throw new ConflictException('Chiến dịch không ở bước chuẩn bị.');
  }
}
