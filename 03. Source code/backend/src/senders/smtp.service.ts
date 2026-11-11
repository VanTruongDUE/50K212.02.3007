import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

export type SmtpAccount = {
  email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secret: string | null;
};
export type MailAsset = {
  kind: 'logo' | 'pdf';
  file_name: string;
  content_type: string;
  content: Buffer;
};

@Injectable()
export class SmtpService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const value = this.config.get<string>('SMTP_ENCRYPTION_KEY');
    if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình khóa SMTP trên máy chủ.',
      );
    }
    return Buffer.from(value, 'hex');
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data]
      .map((part) => part.toString('hex'))
      .join(':');
  }

  credentials(account: SmtpAccount): { user: string; pass: string } {
    if (!account.smtp_user || !account.smtp_secret)
      throw new BadRequestException(
        'Tài khoản chưa có thông tin xác thực email.',
      );
    const [iv, tag, data] = account.smtp_secret
      .split(':')
      .map((part) => Buffer.from(part, 'hex'));
    const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
    decipher.setAuthTag(tag);
    return {
      user: account.smtp_user,
      pass: Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf8',
      ),
    };
  }

  private transport(account: SmtpAccount) {
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

  async verify(account: SmtpAccount): Promise<void> {
    await this.transport(account).verify();
  }

  async send(
    account: SmtpAccount,
    to: string,
    subject: string,
    body: string,
    assets: MailAsset[] = [],
  ): Promise<string> {
    const logo = assets.find(
      (asset) =>
        asset.kind === 'logo' && asset.content_type !== 'image/svg+xml',
    );
    const attachments = assets.map((asset) => ({
      filename: asset.file_name,
      content: asset.content,
      contentType: asset.content_type,
      ...(asset === logo ? { cid: 'v5-logo' } : {}),
    }));
    const escaped = body
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
    const result = await this.transport(account).sendMail({
      from: account.email,
      to,
      subject,
      text: body,
      html: `${logo ? '<p><img src="cid:v5-logo" alt="Logo V5" style="max-width:240px"></p>' : ''}<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${escaped}</div>`,
      attachments,
    });
    if (!result.accepted.includes(to))
      throw new Error('SMTP không chấp nhận người nhận.');
    return result.messageId;
  }
}
