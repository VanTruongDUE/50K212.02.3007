import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class SmtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly google: GoogleMailService,
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

  async verify(account: SmtpAccount): Promise<void> {
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
    const result = await (
      await this.transport(account)
    ).sendMail({
      from: account.email,
      to,
      subject,
      text: rendered.text,
      html: `${logo ? '<p><img src="cid:v5-logo" alt="Logo V5" style="max-width:240px"></p>' : ''}<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${rendered.html}</div>`,
      attachments,
    });
    if (!result.accepted.includes(to))
      throw new Error('SMTP không chấp nhận người nhận.');
    return result.messageId;
  }
}
