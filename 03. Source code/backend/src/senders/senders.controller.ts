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
import { SmtpService, type SmtpAccount } from './smtp.service';

type Sender = QueryResultRow &
  SmtpAccount & {
    id: string;
    name: string;
    status: string;
    quota_3_days: number;
    inbound_enabled: boolean;
  };
type SenderInput = {
  name?: unknown;
  email?: unknown;
  status?: unknown;
  quota3Days?: unknown;
  smtpHost?: unknown;
  smtpPort?: unknown;
  smtpUser?: unknown;
  smtpPassword?: unknown;
  inboundEnabled?: unknown;
};
const publicFields =
  'id, name, email, status, quota_3_days, inbound_enabled, smtp_host, smtp_port, smtp_user, (smtp_secret IS NOT NULL) AS configured, created_at';
const usageField = `((SELECT count(*)::int FROM email_deliveries d WHERE d.sender_account_id=s.id
  AND d.state IN ('sent','sending') AND d.created_at>now()-interval '3 days')
  +(SELECT count(*)::int FROM response_email_deliveries r WHERE r.sender_account_id=s.id
  AND r.state IN ('sent','sending') AND r.created_at>now()-interval '3 days')) AS used_3_days`;

@Controller('api/sender-accounts')
@UseGuards(SessionGuard)
export class SendersController {
  constructor(
    private readonly database: DatabaseService,
    private readonly smtp: SmtpService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const result = await this.database.query(
      `SELECT ${publicFields}, ${usageField}
      FROM sender_accounts s WHERE $1 = 'manager' OR status = 'active' ORDER BY id`,
      [request.account.role],
    );
    return result.rows.map((row) => ({
      ...row,
      quota_warning: Number(row.used_3_days) >= Number(row.quota_3_days) * 0.8,
    }));
  }

  @Get(':id')
  async detail(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.database.query(
      `SELECT ${publicFields}, ${usageField} FROM sender_accounts s WHERE id = $1 AND ($2 = 'manager' OR status = 'active')`,
      [id, request.account.role],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return {
      ...result.rows[0],
      quota_warning:
        Number(result.rows[0].used_3_days) >=
        Number(result.rows[0].quota_3_days) * 0.8,
    };
  }

  @Post()
  @Roles('manager')
  async create(@Body() body: SenderInput) {
    const data = this.validate(body);
    try {
      const result = await this.database.query<Sender>(
        `INSERT INTO sender_accounts (name,email,status,quota_3_days,smtp_host,smtp_port,smtp_user,smtp_secret,inbound_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          data.name,
          data.email,
          data.status,
          data.quota,
          data.host,
          data.port,
          data.user,
          data.secret,
          data.inbound,
        ],
      );
      return this.publicOne(result.rows[0].id);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException('Địa chỉ email người gửi đã tồn tại.');
      throw error;
    }
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SenderInput,
  ) {
    const current = await this.privateOne(id);
    const data = this.validate(body, current);
    try {
      await this.database.query(
        `UPDATE sender_accounts SET name=$2,email=$3,status=$4,quota_3_days=$5,smtp_host=$6,smtp_port=$7,smtp_user=$8,smtp_secret=$9,inbound_enabled=$10 WHERE id=$1`,
        [
          id,
          data.name,
          data.email,
          data.status,
          data.quota,
          data.host,
          data.port,
          data.user,
          data.secret,
          data.inbound,
        ],
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      )
        throw new ConflictException('Địa chỉ email người gửi đã tồn tại.');
      throw error;
    }
    return this.publicOne(id);
  }

  @Post(':id/verify')
  @Roles('manager')
  async verify(@Param('id', ParseIntPipe) id: number) {
    const account = await this.privateOne(id);
    try {
      await this.smtp.verify(account);
    } catch {
      throw new BadRequestException(
        'Không thể kết nối hoặc xác thực SMTP. Kiểm tra cấu hình tài khoản.',
      );
    }
    return { connected: true };
  }

  @Delete(':id')
  @Roles('manager')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.privateOne(id);
    const result = await this.database.query(
      'DELETE FROM sender_accounts WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM campaigns WHERE sender_account_id=$1)',
      [id],
    );
    if (!result.rowCount)
      throw new ConflictException('Tài khoản đã được dùng trong chiến dịch.');
    return { deleted: true };
  }

  private validate(body: SenderInput, current?: Sender) {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Dữ liệu tài khoản gửi không hợp lệ.');
    const name = body.name === undefined ? current?.name : body.name;
    const email = body.email === undefined ? current?.email : body.email;
    const status =
      body.status === undefined ? (current?.status ?? 'inactive') : body.status;
    const quota =
      body.quota3Days === undefined
        ? (current?.quota_3_days ?? 100)
        : body.quota3Days;
    const host =
      body.smtpHost === undefined ? current?.smtp_host : body.smtpHost;
    const port =
      body.smtpPort === undefined ? current?.smtp_port : body.smtpPort;
    const user =
      body.smtpUser === undefined ? current?.smtp_user : body.smtpUser;
    const inbound =
      body.inboundEnabled === undefined
        ? (current?.inbound_enabled ?? false)
        : body.inboundEnabled;
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 100 ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 320 ||
      typeof status !== 'string' ||
      !['active', 'inactive', 'blocked'].includes(status) ||
      !Number.isInteger(quota) ||
      typeof inbound !== 'boolean' ||
      Number(quota) < 1 ||
      Number(quota) > 100
    )
      throw new BadRequestException('Dữ liệu tài khoản gửi không hợp lệ.');
    if (
      host !== undefined &&
      host !== null &&
      (typeof host !== 'string' || !host.trim())
    )
      throw new BadRequestException('Máy chủ SMTP không hợp lệ.');
    if (
      port !== undefined &&
      port !== null &&
      (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535)
    )
      throw new BadRequestException('Cổng SMTP không hợp lệ.');
    if (
      user !== undefined &&
      user !== null &&
      (typeof user !== 'string' || !user.trim())
    )
      throw new BadRequestException('Tên đăng nhập SMTP không hợp lệ.');
    let secret = current?.smtp_secret ?? null;
    if (body.smtpPassword !== undefined) {
      if (
        typeof body.smtpPassword !== 'string' ||
        !body.smtpPassword ||
        body.smtpPassword.length > 1000
      )
        throw new BadRequestException('Mật khẩu SMTP không hợp lệ.');
      secret = this.smtp.encrypt(body.smtpPassword);
    }
    if (status === 'active' && (!host || !port || !user || !secret))
      throw new BadRequestException('Cần cấu hình SMTP trước khi kích hoạt.');
    if (inbound && (!user || !secret))
      throw new BadRequestException(
        'Cần cấu hình thông tin Gmail trước khi bật IMAP.',
      );
    return {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      status,
      quota,
      host: host ?? null,
      port: port ?? null,
      user: user ?? null,
      secret,
      inbound,
    };
  }

  private async privateOne(id: number): Promise<Sender> {
    const result = await this.database.query<Sender>(
      'SELECT * FROM sender_accounts WHERE id=$1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }

  private async publicOne(id: string | number) {
    const result = await this.database.query(
      `SELECT ${publicFields}, ${usageField} FROM sender_accounts s WHERE id=$1`,
      [id],
    );
    return {
      ...result.rows[0],
      quota_warning:
        Number(result.rows[0].used_3_days) >=
        Number(result.rows[0].quota_3_days) * 0.8,
    };
  }
}
