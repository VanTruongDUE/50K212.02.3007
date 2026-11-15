import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { GoogleMailService } from './google-mail.service';
import { decryptMailSecret, encryptMailSecret } from './mail-secret';
import nodemailer from 'nodemailer';
import {
  parseCampaignBody,
  renderCampaignBody,
} from '../campaigns/content-blocks';

export type SmtpAccount = {
  email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secret: string | null;
  google_refresh_secret?: string | null;
  google_status?: string | null;
};
export type MailAsset = {
  id: string;
  kind: 'logo' | 'pdf' | 'image';
  file_name: string;
  content_type: string;
  content: Buffer;
};
export type RelayMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: {
    filename: string;
    content: string;
    contentType: string;
    cid?: string;
  }[];
};

@Injectable()
export class SmtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly google: GoogleMailService,
    @Optional() private readonly database?: DatabaseService,
  ) {}

  encrypt(secret: string): string {
    return encryptMailSecret(this.config, secret);
  }

  credentials(account: SmtpAccount): { user: string; pass: string } {
    if (!account.smtp_user || !account.smtp_secret)
      throw new BadRequestException(
        'Tài khoản chưa có thông tin xác thực email.',
      );
    const password = decryptMailSecret(this.config, account.smtp_secret);
    return {
      user: account.smtp_user,
      // Gmail displays app passwords in groups separated by spaces.
      pass:
        account.smtp_host?.toLowerCase() === 'smtp.gmail.com'
          ? password.replace(/\s/g, '')
          : password,
    };
  }

  async inboxCredentials(account: SmtpAccount) {
    if (account.google_refresh_secret)
      return {
        user: account.email,
        accessToken: await this.google.accessToken(account),
      };
    return this.credentials(account);
  }

  private async transport(account: SmtpAccount) {
    if (account.google_refresh_secret) {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          type: 'OAuth2',
          user: account.email,
          accessToken: await this.google.accessToken(account),
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
      });
    }
    if (
      !account.smtp_host ||
      !account.smtp_port ||
      !account.smtp_user ||
      !account.smtp_secret
    ) {
      throw new BadRequestException('Tài khoản gửi chưa có cấu hình SMTP.');
    }
    return nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      requireTLS: account.smtp_port !== 465,
      auth: this.credentials(account),
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  private async remote(
    account: SmtpAccount,
    action: 'verify' | 'send',
    mail?: RelayMail,
  ) {
    const origin = this.config.get<string>('REMOTE_SMTP_URL');
    const secret = this.config.get<string>('SMTP_RELAY_SECRET');
    if (!origin?.startsWith('https://') || !secret)
      throw new BadRequestException(
        'SMTP relay chưa được cấu hình HTTPS và secret.',
      );
    if (!this.database) throw new Error('SMTP relay database unavailable.');
    const requestId = randomUUID();
    await this.database.query(
      "DELETE FROM smtp_relay_requests WHERE created_at<now()-interval '2 minutes'",
    );
    await this.database.query(
      'INSERT INTO smtp_relay_requests(id,account_email,action,mail) VALUES($1,$2,$3,$4)',
      [requestId, account.email, action, mail ?? null],
    );
    const body = JSON.stringify({ requestId });
    try {
      const response = await fetch(
        `${origin.replace(/\/$/, '')}/api/internal/smtp/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body,
          signal: AbortSignal.timeout(30000),
          redirect: 'error',
        },
      );
      if (!response.ok) throw new Error('relay rejected');
      const result = (await response.json()) as {
        messageId?: string;
        accepted?: string[];
      };
      if (
        action === 'send' &&
        (!result.messageId || !result.accepted?.includes(mail!.to))
      )
        throw new Error('recipient rejected');
      return result;
    } catch {
      throw new Error(
        'SMTP relay chưa xác nhận kết quả. Kiểm tra hộp thư đã gửi trước khi thử lại để tránh gửi trùng.',
      );
    } finally {
      await this.database.query('DELETE FROM smtp_relay_requests WHERE id=$1', [
        requestId,
      ]);
    }
  }

  async relay(
    account: SmtpAccount,
    action: 'verify' | 'send',
    mail?: RelayMail,
  ) {
    if (action === 'verify') {
      await (await this.transport(account)).verify();
      return { ok: true };
    }
    const result = await (
      await this.transport(account)
    ).sendMail({
      from: account.email,
      to: mail!.to,
      subject: mail!.subject,
      text: mail!.text,
      html: mail!.html,
      disableFileAccess: true,
      disableUrlAccess: true,
      attachments: mail!.attachments.map((item) => ({
        ...item,
        content: Buffer.from(item.content, 'base64'),
      })),
    });
    return {
      messageId: result.messageId,
      accepted: result.accepted.filter((value) => typeof value === 'string'),
    };
  }

  async verify(account: SmtpAccount): Promise<void> {
    if (this.config.get<string>('REMOTE_SMTP_URL')) {
      await this.remote(account, 'verify');
      return;
    }
    await (await this.transport(account)).verify();
  }

  async send(
    account: SmtpAccount,
    to: string,
    subject: string,
    body: string,
    assets: MailAsset[] = [],
    personalizeCampaign?: (value: string) => string,
  ): Promise<string> {
    const imageIds = personalizeCampaign
      ? new Set(
          parseCampaignBody(body)
            .filter((block) => block.kind === 'image')
            .map((block) => String(block.id)),
        )
      : new Set<string>();
    const includedAssets = assets.filter(
      (asset) => asset.kind !== 'image' || imageIds.has(asset.id),
    );
    const logo = assets.find(
      (asset) =>
        asset.kind === 'logo' && asset.content_type !== 'image/svg+xml',
    );
    const attachments = includedAssets.map((asset) => ({
      filename: asset.file_name,
      content: asset.content,
      contentType: asset.content_type,
      ...(asset === logo
        ? { cid: 'v5-logo' }
        : asset.kind === 'image'
          ? { cid: `v5-image-${asset.id}` }
          : {}),
    }));
    const escaped = body
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
    const rendered = personalizeCampaign
      ? renderCampaignBody(body, includedAssets, personalizeCampaign)
      : { text: body, html: escaped };
    const mail = {
      to,
      subject,
      text: rendered.text,
      html: `${logo ? '<p><img src="cid:v5-logo" alt="Logo V5" style="max-width:240px"></p>' : ''}<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${rendered.html}</div>`,
      attachments,
    };
    if (this.config.get<string>('REMOTE_SMTP_URL')) {
      const result = await this.remote(account, 'send', {
        ...mail,
        attachments: attachments.map((item) => ({
          ...item,
          content: item.content.toString('base64'),
        })),
      });
      return result.messageId!;
    }
    const result = await (
      await this.transport(account)
    ).sendMail({
      from: account.email,
      ...mail,
    });
    if (!result.accepted.includes(to))
      throw new Error('SMTP không chấp nhận người nhận.');
    return result.messageId;
  }
}
