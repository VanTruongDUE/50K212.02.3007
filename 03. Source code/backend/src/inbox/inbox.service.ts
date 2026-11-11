import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import PostalMime from 'postal-mime';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { SmtpService, type SmtpAccount } from '../senders/smtp.service';

type InboxAccount = QueryResultRow &
  SmtpAccount & { id: string; inbound_enabled: boolean };
type Mail = Awaited<ReturnType<typeof PostalMime.parse>>;

export function classifyIncoming(
  email: string,
  subject: string,
  content: string,
  autoSubmitted = '',
): string {
  if (
    /mailer-daemon|postmaster/i.test(email) &&
    /delivery|undeliver|failure/i.test(subject)
  )
    return 'bounce';
  if (/auto-replied/i.test(autoSubmitted)) return 'out_of_office';
  if (
    /(^|\n)\s*(unsubscribe|please remove me|ngừng nhận email|không gửi.*email)/i.test(
      content.slice(0, 1000),
    )
  )
    return 'unsubscribe';
  return 'other';
}

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxService.name);
  private timer?: NodeJS.Timeout;
  private syncing = false;
  private readonly activeAccounts = new Set<string>();

  constructor(
    private readonly database: DatabaseService,
    private readonly smtp: SmtpService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.syncAll();
    }, 120000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async verify(id: number): Promise<void> {
    const account = await this.account(id);
    const client = this.client(account);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      lock.release();
    } finally {
      if (client.authenticated) await client.logout();
    }
  }

  async unmatched() {
    return (
      await this.database
        .query(`SELECT m.sender_account_id,m.uid_validity,m.uid,m.sender_email,m.subject,m.content,m.received_at,s.name AS account_name
      FROM inbound_messages m JOIN sender_accounts s ON s.id=m.sender_account_id
      WHERE m.response_id IS NULL AND m.ignored_at IS NULL ORDER BY m.received_at DESC LIMIT 100`)
    ).rows;
  }

  async assign(
    accountId: number,
    validity: string,
    uid: number,
    body: { employeeId?: unknown; campaignId?: unknown; kind?: unknown },
  ) {
    if (
      !/^\d+$/.test(validity) ||
      !Number.isSafeInteger(uid) ||
      uid < 1 ||
      typeof body?.employeeId !== 'string' ||
      !body.employeeId ||
      typeof body.kind !== 'string' ||
      ![
        'interested',
        'not_interested',
        'need_info',
        'out_of_office',
        'bounce',
        'unsubscribe',
        'spam',
        'other',
      ].includes(body.kind)
    )
      throw new BadRequestException('Phân công email đến không hợp lệ.');
    if (
      body.campaignId !== undefined &&
      (!Number.isSafeInteger(body.campaignId) || Number(body.campaignId) < 1)
    )
      throw new BadRequestException('Chiến dịch không hợp lệ.');
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const incoming = await client.query<
        {
          sender_email: string | null;
          content: string | null;
          received_at: Date;
        } & QueryResultRow
      >(
        'SELECT sender_email,content,received_at FROM inbound_messages WHERE sender_account_id=$1 AND uid_validity=$2 AND uid=$3 AND response_id IS NULL AND ignored_at IS NULL FOR UPDATE',
        [accountId, validity, uid],
      );
      const message = incoming.rows[0];
      if (!message)
        throw new NotFoundException('Không tìm thấy email chưa phân công.');
      if (
        !message.sender_email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.sender_email)
      )
        throw new ConflictException('Email không có địa chỉ người gửi hợp lệ.');
      const employee = await client.query(
        "SELECT 1 FROM login_accounts WHERE employee_id=$1 AND role='employee'",
        [body.employeeId],
      );
      if (!employee.rowCount)
        throw new NotFoundException('Không tìm thấy Nhân viên.');
      if (body.campaignId !== undefined) {
        const campaign = await client.query(
          'SELECT 1 FROM campaigns WHERE id=$1 AND owner_id=$2',
          [body.campaignId, body.employeeId],
        );
        if (!campaign.rowCount)
          throw new ConflictException(
            'Chiến dịch không thuộc Nhân viên được chọn.',
          );
      }
      const contact = await client.query<{ id: string } & QueryResultRow>(
        'SELECT id FROM contacts WHERE lower(email)=lower($1)',
        [message.sender_email],
      );
      const response = await client.query<{ id: string } & QueryResultRow>(
        'INSERT INTO responses(campaign_id,contact_id,customer_name,email,kind,assignee_id,content,received_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [
          body.campaignId ?? null,
          contact.rows[0]?.id ?? null,
          message.sender_email,
          message.sender_email,
          body.kind,
          body.employeeId,
          message.content || '[Không có nội dung văn bản]',
          message.received_at,
        ],
      );
      await client.query(
        'UPDATE inbound_messages SET response_id=$4 WHERE sender_account_id=$1 AND uid_validity=$2 AND uid=$3',
        [accountId, validity, uid, response.rows[0].id],
      );
      if (body.kind === 'unsubscribe' || body.kind === 'bounce') {
        await client.query(
          'INSERT INTO email_suppressions(email,reason) VALUES(lower($1),$2) ON CONFLICT(email) DO NOTHING',
          [message.sender_email, body.kind],
        );
        await client.query(
          `UPDATE contacts SET ${body.kind === 'bounce' ? 'bounced_at' : 'unsubscribed_at'}=now() WHERE lower(email)=lower($1)`,
          [message.sender_email],
        );
      }
      await client.query('COMMIT');
      return { response_id: response.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ignore(accountId: number, validity: string, uid: number) {
    if (!/^\d+$/.test(validity) || !Number.isSafeInteger(uid) || uid < 1)
      throw new BadRequestException('Mã email không hợp lệ.');
    const result = await this.database.query(
      'UPDATE inbound_messages SET ignored_at=now() WHERE sender_account_id=$1 AND uid_validity=$2 AND uid=$3 AND response_id IS NULL AND ignored_at IS NULL RETURNING uid',
      [accountId, validity, uid],
    );
    if (!result.rowCount) throw new NotFoundException();
    return { ignored: true };
  }

  async sync(id: number): Promise<{ imported: number; initialised: boolean }> {
    const account = await this.account(id);
    if (!account.inbound_enabled)
      throw new ConflictException('IMAP chưa được bật cho tài khoản này.');
    if (this.activeAccounts.has(account.id))
      throw new ConflictException('Hộp thư đang được đồng bộ.');
    this.activeAccounts.add(account.id);
    let client: ImapFlow | undefined;
    try {
      client = this.client(account);
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        if (!client.mailbox) throw new Error('INBOX unavailable');
        const validity = String(client.mailbox.uidValidity);
        const next = Number(client.mailbox.uidNext);
        if (!Number.isSafeInteger(next) || next < 1 || !validity)
          throw new Error('Invalid IMAP mailbox cursor');
        const cursor = await this.database.query<
          { uid_validity: string; last_uid: string } & QueryResultRow
        >(
          'SELECT uid_validity,last_uid FROM imap_cursors WHERE sender_account_id=$1',
          [id],
        );
        if (!cursor.rows[0] || cursor.rows[0].uid_validity !== validity) {
          // shortcut: first sync starts at the current inbox end; import older mail only with a separate backfill flow.
          await this.database.query(
            `INSERT INTO imap_cursors(sender_account_id,uid_validity,last_uid) VALUES($1,$2,$3)
            ON CONFLICT(sender_account_id) DO UPDATE SET uid_validity=EXCLUDED.uid_validity,last_uid=EXCLUDED.last_uid,updated_at=now()`,
            [id, validity, next - 1],
          );
          return { imported: 0, initialised: true };
        }
        const last = Number(cursor.rows[0].last_uid);
        if (next <= last + 1) return { imported: 0, initialised: false };
        const batch: Array<{ uid: number; size: number }> = [];
        for await (const message of client.fetch(
          `${last + 1}:${next - 1}`,
          { uid: true, size: true },
          { uid: true },
        )) {
          batch.push({ uid: message.uid, size: message.size ?? 0 });
          if (batch.length === 50) break;
        }
        if (!batch.length) {
          await this.database.query(
            'UPDATE imap_cursors SET last_uid=$2,updated_at=now() WHERE sender_account_id=$1',
            [id, next - 1],
          );
          return { imported: 0, initialised: false };
        }
        let imported = 0;
        for (const message of batch) {
          const fetched =
            message.size <= 2_000_000
              ? await client.fetchOne(
                  message.uid,
                  { source: true, internalDate: true },
                  { uid: true },
                )
              : false;
          let parsed: Mail | null = null;
          if (fetched && fetched.source) {
            try {
              parsed = await PostalMime.parse(fetched.source);
            } catch {
              this.logger.warn(
                `Bỏ qua thư IMAP không đọc được, UID ${message.uid}.`,
              );
            }
          }
          imported += await this.store(
            account,
            validity,
            message.uid,
            parsed,
            fetched && fetched.internalDate instanceof Date
              ? fetched.internalDate
              : new Date(),
          );
        }
        return { imported, initialised: false };
      } finally {
        lock.release();
      }
    } finally {
      this.activeAccounts.delete(account.id);
      if (client?.authenticated) await client.logout();
    }
  }

  private async syncAll(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const accounts = await this.database.query<
        { id: number } & QueryResultRow
      >(
        "SELECT id FROM sender_accounts WHERE inbound_enabled=true AND status='active'",
      );
      for (const account of accounts.rows) {
        try {
          await this.sync(account.id);
        } catch {
          this.logger.warn(
            `Không đồng bộ được Gmail IMAP cho tài khoản ${account.id}.`,
          );
        }
      }
    } catch {
      this.logger.warn('Không lấy được danh sách hộp thư Gmail để đồng bộ.');
    } finally {
      this.syncing = false;
    }
  }

  private async store(
    account: InboxAccount,
    validity: string,
    uid: number,
    mail: Mail | null,
    receivedAt: Date,
  ): Promise<number> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const already = await client.query(
        'SELECT 1 FROM inbound_messages WHERE sender_account_id=$1 AND uid_validity=$2 AND uid=$3',
        [account.id, validity, uid],
      );
      if (already.rowCount) {
        await client.query(
          'UPDATE imap_cursors SET last_uid=greatest(last_uid,$2),updated_at=now() WHERE sender_account_id=$1',
          [account.id, uid],
        );
        await client.query('COMMIT');
        return 0;
      }
      const from =
        mail?.from &&
        'address' in mail.from &&
        typeof mail.from.address === 'string'
          ? mail.from.address.trim().toLowerCase()
          : '';
      const content = (
        mail?.text ||
        mail?.subject ||
        '[Không có nội dung văn bản]'
      ).slice(0, 100000);
      let responseId: string | null = null;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
        const match = await client.query<
          {
            campaign_id: string;
            contact_id: string;
            owner_id: string;
            full_name: string | null;
          } & QueryResultRow
        >(
          `SELECT d.campaign_id,d.contact_id,c.owner_id,ct.full_name FROM email_deliveries d
           JOIN campaigns c ON c.id=d.campaign_id JOIN contacts ct ON ct.id=d.contact_id
           WHERE d.sender_account_id=$1 AND lower(ct.email)=$2 AND d.state='sent'
             AND d.sent_at>now()-interval '90 days'
           ORDER BY coalesce(d.provider_message_id=$3,false) DESC,d.sent_at DESC LIMIT 1`,
          [account.id, from, mail?.inReplyTo ?? ''],
        );
        if (match.rows[0]) {
          const autoSubmitted =
            mail?.headers.find((header) => header.key === 'auto-submitted')
              ?.value ?? '';
          const kind = classifyIncoming(
            from,
            mail?.subject ?? '',
            content,
            autoSubmitted,
          );
          const response = await client.query<{ id: string } & QueryResultRow>(
            `INSERT INTO responses(campaign_id,contact_id,customer_name,email,kind,assignee_id,content,received_at)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [
              match.rows[0].campaign_id,
              match.rows[0].contact_id,
              match.rows[0].full_name || from,
              from,
              kind,
              match.rows[0].owner_id,
              content,
              receivedAt,
            ],
          );
          responseId = response.rows[0].id;
          if (kind === 'unsubscribe' || kind === 'bounce') {
            await client.query(
              'INSERT INTO email_suppressions(email,reason) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',
              [from, kind],
            );
            await client.query(
              `UPDATE contacts SET ${kind === 'bounce' ? 'bounced_at' : 'unsubscribed_at'}=now() WHERE id=$1`,
              [match.rows[0].contact_id],
            );
          }
        }
      }
      await client.query(
        'INSERT INTO inbound_messages(sender_account_id,uid_validity,uid,message_id,response_id,received_at,sender_email,subject,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          account.id,
          validity,
          uid,
          mail?.messageId ?? null,
          responseId,
          receivedAt,
          from || null,
          mail?.subject?.slice(0, 500) ?? null,
          content,
        ],
      );
      await client.query(
        'UPDATE imap_cursors SET last_uid=greatest(last_uid,$2),updated_at=now() WHERE sender_account_id=$1',
        [account.id, uid],
      );
      await client.query('COMMIT');
      return responseId ? 1 : 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private client(account: InboxAccount): ImapFlow {
    return new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: this.smtp.credentials(account),
      logger: false,
      connectionTimeout: 10000,
    });
  }

  private async account(id: number): Promise<InboxAccount> {
    const result = await this.database.query<InboxAccount>(
      'SELECT * FROM sender_accounts WHERE id=$1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException();
    return result.rows[0];
  }
}
