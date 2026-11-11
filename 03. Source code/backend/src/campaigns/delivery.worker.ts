import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  SmtpService,
  type SmtpAccount,
  type MailAsset,
} from '../senders/smtp.service';
import { fill } from './campaigns.controller';

type Job = QueryResultRow &
  SmtpAccount & {
    campaign_id: string;
    contact_id: string;
    account_id: string;
    recipient_email: string;
    full_name: string | null;
    company: string | null;
    unsubscribe_token: string;
    subject: string;
    body: string;
    quota_3_days: number;
  };

export const claimDeliverySql = `SELECT ca.id AS campaign_id, cr.contact_id, sa.id AS account_id,
  ct.email AS recipient_email,ct.full_name,ct.company,ct.unsubscribe_token,
  ca.subject,ca.body,sa.email,sa.smtp_host,sa.smtp_port,sa.smtp_user,sa.smtp_secret,sa.quota_3_days
 FROM campaign_recipients cr JOIN campaigns ca ON ca.id=cr.campaign_id
 JOIN contacts ct ON ct.id=cr.contact_id JOIN sender_accounts sa ON sa.id=ca.sender_account_id
 WHERE ca.status IN ('scheduled','sending') AND ca.scheduled_at<=now()
   AND cr.status='pending' AND sa.status='active'
   AND NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d.contact_id=ct.id AND d.state='sending')
 ORDER BY ca.scheduled_at,cr.contact_id LIMIT 1 FOR UPDATE OF ca,cr,sa SKIP LOCKED`;

@Injectable()
export class DeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly database: DatabaseService,
    private readonly smtp: SmtpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.database
      .query(
        `UPDATE campaigns SET status='paused' WHERE id IN
       (SELECT campaign_id FROM email_deliveries WHERE state='sending') AND status IN ('scheduled','sending')`,
      )
      .catch(() =>
        this.logger.warn('Chưa thể kiểm tra các lần gửi dở khi khởi động.'),
      );
    this.timer = setInterval(() => {
      void this.tick();
    }, 30000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.deliverOne();
    } catch {
      this.logger.error(
        'Không thể xử lý lượt gửi email. Kiểm tra kết nối PostgreSQL và trạng thái chiến dịch.',
      );
    } finally {
      this.running = false;
    }
  }

  private async deliverOne(): Promise<void> {
    await this.database.query(
      `UPDATE campaigns SET status='paused',updated_at=now() WHERE status IN ('scheduled','sending')
       AND sender_account_id IN (SELECT id FROM sender_accounts WHERE status<>'active')`,
    );
    const baseUrl = this.config.get<string>('PUBLIC_BASE_URL');
    if (!baseUrl || !/^https?:\/\/[^/]+/.test(baseUrl)) return;
    const hour = Number(
      (
        await this.database.query<{ hour: number }>(
          "SELECT extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')::int AS hour",
        )
      ).rows[0].hour,
    );
    if (hour < 8 || hour >= 17) return;
    const client = await this.database.connect();
    let job: Job | undefined;
    let deliveryId: string | undefined;
    try {
      await client.query('BEGIN');
      const result = await client.query<Job>(claimDeliverySql);
      job = result.rows[0];
      if (!job) {
        await client.query('COMMIT');
        return;
      }
      if (
        (
          await client.query(
            'SELECT 1 FROM contacts WHERE id=$1 AND (unsubscribed_at IS NOT NULL OR bounced_at IS NOT NULL)',
            [job.contact_id],
          )
        ).rowCount ||
        (
          await client.query(
            'SELECT 1 FROM email_suppressions WHERE email=lower($1)',
            [job.recipient_email],
          )
        ).rowCount ||
        (
          await client.query(
            "SELECT 1 FROM email_deliveries WHERE contact_id=$1 AND state='sent' AND sent_at>now()-interval '7 days' LIMIT 1",
            [job.contact_id],
          )
        ).rowCount
      ) {
        await client.query(
          "UPDATE campaign_recipients SET status='skipped' WHERE campaign_id=$1 AND contact_id=$2",
          [job.campaign_id, job.contact_id],
        );
        await client.query('COMMIT');
        await this.finishIfDone(job.campaign_id);
        return;
      }
      const quota = await client.query<{ used: string; hourly: string }>(
        `SELECT count(*) FILTER (WHERE created_at>now()-interval '3 days') AS used,
          count(*) FILTER (WHERE created_at>now()-interval '1 hour') AS hourly
         FROM email_deliveries WHERE sender_account_id=$1 AND state IN ('sending','sent')`,
        [job.account_id],
      );
      if (
        Number(quota.rows[0].used) >= job.quota_3_days ||
        Number(quota.rows[0].hourly) >= 50
      ) {
        await client.query('COMMIT');
        return;
      }
      const delivery = await client.query<{ id: string }>(
        "INSERT INTO email_deliveries(campaign_id,contact_id,sender_account_id,state) VALUES($1,$2,$3,'sending') RETURNING id",
        [job.campaign_id, job.contact_id, job.account_id],
      );
      deliveryId = delivery.rows[0].id;
      await client.query(
        "UPDATE campaigns SET status='sending',updated_at=now() WHERE id=$1",
        [job.campaign_id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!job || !deliveryId) return;
    let smtpAccepted = false;
    try {
      const assets = await this.database.query<MailAsset & QueryResultRow>(
        'SELECT kind,file_name,content_type,content FROM campaign_assets WHERE campaign_id=$1 ORDER BY id',
        [job.campaign_id],
      );
      const link = `${baseUrl.replace(/\/$/, '')}/api/unsubscribe/${job.unsubscribe_token}`;
      const messageId = await this.smtp.send(
        job,
        job.recipient_email,
        fill(job.subject, job.full_name, job.company),
        `${fill(job.body, job.full_name, job.company)}\n\nNgừng nhận email: ${link}`,
        assets.rows,
      );
      smtpAccepted = true;
      const result = await this.database.connect();
      try {
        await result.query('BEGIN');
        await result.query(
          "UPDATE email_deliveries SET state='sent',sent_at=now(),provider_message_id=$2 WHERE id=$1",
          [deliveryId, messageId],
        );
        await result.query(
          "UPDATE campaign_recipients SET status='sent',sent_at=now() WHERE campaign_id=$1 AND contact_id=$2",
          [job.campaign_id, job.contact_id],
        );
        await result.query(
          'UPDATE campaigns SET sent_count=sent_count+1,updated_at=now() WHERE id=$1',
          [job.campaign_id],
        );
        await result.query('COMMIT');
      } catch (error) {
        await result.query('ROLLBACK');
        throw error;
      } finally {
        result.release();
      }
      await this.finishIfDone(job.campaign_id);
    } catch {
      // shortcut: SMTP acceptance may be uncertain after a crash; pause for manual review instead of automatic retry.
      await this.database.query(
        "UPDATE campaigns SET status='paused',updated_at=now() WHERE id=$1",
        [job.campaign_id],
      );
      if (!smtpAccepted)
        await this.database.query(
          "UPDATE email_deliveries SET state='failed',error='SMTP không xác nhận đã gửi' WHERE id=$1 AND state='sending'",
          [deliveryId],
        );
      this.logger.warn(
        `Chiến dịch ${job.campaign_id} tạm dừng vì gửi email không thành công hoặc chưa xác định.`,
      );
    }
  }

  private async finishIfDone(id: string): Promise<void> {
    await this.database.query(
      `UPDATE campaigns SET status='completed',updated_at=now() WHERE id=$1 AND status IN ('scheduled','sending')
       AND NOT EXISTS(SELECT 1 FROM campaign_recipients WHERE campaign_id=$1 AND status='pending')`,
      [id],
    );
  }
}
