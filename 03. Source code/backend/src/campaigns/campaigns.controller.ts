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
    .replaceAll(variables[0], name || '')
    .replaceAll(variables[1], company || '');
}

type Campaign = QueryResultRow & {
  id: string;
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
type CreateInput = { name?: unknown; description?: unknown; listIds?: unknown };
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
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT c.id,c.name,c.description,c.subject,c.body,c.status,c.owner_id,c.sender_account_id,c.sender_name,c.needs_reconfirmation,c.filter_summary,c.scheduled_at,c.send_mode,c.send_rate,c.window_start,c.window_end,c.sent_count,c.paused_at,c.pause_reason,c.created_at,
       (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id=c.id) AS recipient_count
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

  @Post()
  @Roles('employee')
  async create(
    @Body() body: CreateInput,
    @Req() request: AuthenticatedRequest,
  ) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const listIds = body?.listIds;
    if (
      !name ||
      name.length > 100 ||
      !Array.isArray(listIds) ||
      !listIds.length ||
      listIds.length > 20 ||
      !listIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
      new Set(listIds).size !== listIds.length
    )
      throw new BadRequestException(
        'Tên chiến dịch hoặc danh sách Contact không hợp lệ.',
      );
    const description =
      body.description === undefined ? null : body.description;
    if (
      description !== null &&
      (typeof description !== 'string' || description.length > 2000)
    )
      throw new BadRequestException('Mô tả không hợp lệ.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const approved = await client.query(
        `SELECT id FROM contact_lists WHERE id = ANY($1::bigint[]) AND owner_id=$2 AND confirmed_at IS NOT NULL AND manager_review='approved' FOR SHARE`,
        [listIds, request.account.id],
      );
      if (approved.rowCount !== listIds.length)
        throw new ConflictException(
          'Chỉ chọn danh sách đã xác nhận và được Trưởng phòng duyệt.',
        );
      const created = await client.query<Campaign>(
        "INSERT INTO campaigns(name,description,owner_id,status) VALUES($1,$2,$3,'approved') RETURNING *",
        [name, description, request.account.id],
      );
      const id = created.rows[0].id;
      await client.query(
        'INSERT INTO campaign_lists(campaign_id,list_id) SELECT $1::bigint, unnest($2::bigint[])',
        [id, listIds],
      );
      await client.query(
        `INSERT INTO campaign_recipients(campaign_id,contact_id)
         SELECT DISTINCT $1::bigint,c.id FROM contacts c JOIN contact_list_items i ON i.contact_id=c.id
         WHERE i.list_id=ANY($2::bigint[]) AND c.unsubscribed_at IS NULL AND c.bounced_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM email_suppressions x WHERE x.email=lower(c.email))
         AND c.email ~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'
         AND NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d.contact_id=c.id AND d.state='sent' AND d.sent_at > now()-interval '7 days')`,
        [id, listIds],
      );
      const count = await client.query<{ count: string }>(
        'SELECT count(*) FROM campaign_recipients WHERE campaign_id=$1',
        [id],
      );
      const totals = await client.query<{
        original: number;
        duplicate: number;
        invalid: number;
        unsubscribe: number;
        bounce: number;
        recent: number;
      }>(
        `WITH candidates AS (
        SELECT c.*, row_number() OVER(PARTITION BY c.id ORDER BY i.list_id) AS occurrence,
          EXISTS(SELECT 1 FROM email_suppressions x WHERE x.email=lower(c.email)) AS suppressed,
          EXISTS(SELECT 1 FROM email_deliveries d WHERE d.contact_id=c.id AND d.state='sent' AND d.sent_at>now()-interval '7 days') AS recent
        FROM contacts c JOIN contact_list_items i ON i.contact_id=c.id WHERE i.list_id=ANY($1::bigint[])
      ), classified AS (SELECT CASE WHEN occurrence>1 THEN 'duplicate'
        WHEN email !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' THEN 'invalid'
        WHEN unsubscribed_at IS NOT NULL OR suppressed THEN 'unsubscribe'
        WHEN bounced_at IS NOT NULL THEN 'bounce' WHEN recent THEN 'recent' ELSE 'valid' END AS reason FROM candidates)
        SELECT count(*)::int AS original,
          count(*) FILTER(WHERE reason='duplicate')::int AS duplicate,
          count(*) FILTER(WHERE reason='invalid')::int AS invalid,
          count(*) FILTER(WHERE reason='unsubscribe')::int AS unsubscribe,
          count(*) FILTER(WHERE reason='bounce')::int AS bounce,
          count(*) FILTER(WHERE reason='recent')::int AS recent FROM classified`,
        [listIds],
      );
      const original = Number(totals.rows[0].original),
        valid = Number(count.rows[0].count);
      const filter = {
        ...totals.rows[0],
        original,
        valid,
        excluded: original - valid,
      };
      if (valid === 0)
        throw new ConflictException({
          message: 'Không còn người nhận hợp lệ sau khi lọc.',
          filter,
        });
      await client.query('UPDATE campaigns SET filter_summary=$2 WHERE id=$1', [
        id,
        filter,
      ]);
      await client.query('COMMIT');
      return {
        ...created.rows[0],
        recipient_count: Number(count.rows[0].count),
        filter_summary: filter,
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

  @Post(':id/recipients/confirm')
  @Roles('employee')
  async confirmRecipients(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const campaign = await this.owned(id, request);
    this.editable(campaign);
    const saved = await this.database.query(
      "UPDATE campaigns SET updated_at=now() WHERE id=$1 AND status='approved' AND EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1) AND NOT EXISTS(SELECT 1 FROM campaign_lists cl JOIN contact_lists l ON l.id=cl.list_id WHERE cl.campaign_id=$1 AND l.manager_review<>'approved') RETURNING *",
      [id],
    );
    if (!saved.rows[0])
      throw new ConflictException(
        'Danh sách người nhận không còn hợp lệ. Chọn lại danh sách đã duyệt.',
      );
    return saved.rows[0];
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
      "UPDATE campaigns SET subject=$2,body=$3,previewed_at=CASE WHEN preview_draft_hash=$4 THEN now() ELSE NULL END,preview_draft_hash=NULL,needs_reconfirmation=(status='paused'),updated_at=now() WHERE id=$1 AND status IN ('approved','paused') AND (NOT $5::boolean OR preview_draft_hash=$4) RETURNING *",
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
    const draft = body?.subject !== undefined || body?.body !== undefined;
    const value = draft
      ? await this.checkedContent(id, body)
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
    if (draft)
      await this.database.query(
        'UPDATE campaigns SET preview_draft_hash=$2 WHERE id=$1',
        [
          id,
          createHash('sha256')
            .update(JSON.stringify([value.subject, value.content]))
            .digest('hex'),
        ],
      );
    else
      await this.database.query(
        "UPDATE campaigns SET previewed_at=now() WHERE id=$1 AND status IN ('approved','paused')",
        [id],
      );
    const assets = await this.database.query(
      'SELECT id,kind,file_name,content_type,size_bytes FROM campaign_assets WHERE campaign_id=$1 ORDER BY id',
      [id],
    );
    return {
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
    const result = await this.database.query(
      "UPDATE campaigns SET sender_account_id=$2,sender_name=COALESCE($3,(SELECT name FROM sender_accounts WHERE id=$2)),needs_reconfirmation=(status='paused'),updated_at=now() WHERE id=$1 AND status IN ('approved','paused') RETURNING *",
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
    const rate = body.rate ?? 50;
    const windowStart = body.windowStart ?? '08:00';
    const windowEnd = body.windowEnd ?? '17:00';
    if (
      !Number.isInteger(rate) ||
      Number(rate) < 1 ||
      Number(rate) > 100 ||
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
    const result = await this.database.query(
      "UPDATE campaigns SET needs_reconfirmation=(status='paused'),scheduled_at=$2,send_mode=$3,send_rate=$4,window_start=$5,window_end=$6,updated_at=now() WHERE id=$1 AND status IN ('approved','paused') RETURNING *",
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
      `UPDATE campaigns SET status='scheduled',updated_at=now() WHERE id=$1 AND status='approved' AND EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1) RETURNING *`,
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
      `UPDATE campaigns SET needs_reconfirmation=false,status='scheduled',scheduled_at=CASE WHEN send_mode='now' THEN now() ELSE GREATEST(scheduled_at,now()+interval '15 minutes') END,updated_at=now() WHERE id=$1 AND status='paused' AND previewed_at IS NOT NULL AND EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1 AND status='pending') AND NOT EXISTS(SELECT 1 FROM email_deliveries WHERE campaign_id=$1 AND state='sending') RETURNING *`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Không còn email chưa gửi để tiếp tục.');
    if (campaign.send_mode === 'now') void this.delivery.tick();
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
      `DELETE FROM campaigns WHERE id=$1 AND status IN ('draft','approved','scheduled','paused') AND sent_count=0 AND NOT EXISTS(SELECT 1 FROM email_deliveries WHERE campaign_id=$1) RETURNING id`,
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Chỉ Ẩn chiến dịch chưa gửi.');
    return { deleted: true };
  }

  private async checkedContent(id: number, body: ContentInput) {
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
    if (unsupported?.length)
      throw new BadRequestException('Biến cá nhân hóa không được hỗ trợ.');
    if (/\{\{|\}\}/.test((subject + content).replace(/\{\{[^{}]*\}\}/g, '')))
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
      "SELECT campaigns.*,(SELECT count(*)::int FROM campaign_recipients WHERE campaign_id=campaigns.id) AS recipient_count FROM campaigns WHERE id=$1 AND ($2='manager' OR owner_id=$3)",
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
    }>(
      `SELECT s.quota_3_days
        - (SELECT count(*) FROM email_deliveries d WHERE d.sender_account_id=s.id AND d.state IN ('sent','sending') AND d.created_at>now()-interval '3 days')
        - (SELECT count(*) FROM response_email_deliveries r WHERE r.sender_account_id=s.id AND r.state IN ('sent','sending') AND r.created_at>now()-interval '3 days') AS remaining,
        (SELECT count(*) FROM campaign_recipients WHERE campaign_id=$2 AND status='pending') AS pending
       FROM sender_accounts s WHERE s.id=$1 AND s.status='active' AND ((s.google_refresh_secret IS NOT NULL AND s.google_status='connected') OR (s.google_refresh_secret IS NULL AND s.smtp_secret IS NOT NULL))`,
      [senderId, campaignId],
    );
    if (!result.rows[0])
      throw new ConflictException('Tài khoản gửi không còn hoạt động.');
    if (Number(result.rows[0].remaining) < Number(result.rows[0].pending))
      throw new ConflictException(
        'Tài khoản gửi không đủ hạn mức cho số email còn lại.',
      );
  }

  private editable(campaign: Campaign, allowPaused = false) {
    if (
      campaign.status !== 'approved' &&
      !(allowPaused && campaign.status === 'paused')
    )
      throw new ConflictException('Chiến dịch không ở bước chuẩn bị.');
  }
}
