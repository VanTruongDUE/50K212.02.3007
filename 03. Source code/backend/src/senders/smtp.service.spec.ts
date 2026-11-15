import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { GoogleMailService } from './google-mail.service';
import { SmtpService } from './smtp.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('SmtpService', () => {
  it('uses OAuth for both SMTP and IMAP and never sends tokens to a custom SMTP host', async () => {
    const config = {
      get: (key: string) =>
        key === 'SMTP_ENCRYPTION_KEY' ? 'ab'.repeat(32) : undefined,
    } as unknown as ConfigService;
    const google = {
      accessToken: jest.fn().mockResolvedValue('oauth-access'),
    } as unknown as GoogleMailService;
    const service = new SmtpService(config, google);
    const verify = jest.fn().mockResolvedValue(true);
    jest
      .mocked(nodemailer.createTransport)
      .mockReturnValue({ verify } as unknown as ReturnType<
        typeof nodemailer.createTransport
      >);
    const account = {
      email: 'sender@gmail.com',
      smtp_host: 'untrusted.invalid',
      smtp_port: 2525,
      smtp_user: 'wrong-user',
      smtp_secret: null,
      google_refresh_secret: 'encrypted',
      google_status: 'connected',
    };
    await service.verify(account);
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          type: 'OAuth2',
          user: 'sender@gmail.com',
          accessToken: 'oauth-access',
        },
      }),
    );
    expect(await service.inboxCredentials(account)).toEqual({
      user: 'sender@gmail.com',
      accessToken: 'oauth-access',
    });
  });
  it.each([
    ['smtp.gmail.com', 'abcdefghijklmnop'],
    ['SMTP.GMAIL.COM', 'abcdefghijklmnop'],
    ['smtp.example.com', 'abcd efgh ijkl mnop'],
  ])('handles password spacing for %s', (host, expected) => {
    const config = {
      get: (key: string) =>
        key === 'SMTP_ENCRYPTION_KEY' ? 'ab'.repeat(32) : undefined,
    } as unknown as ConfigService;
    const service = new SmtpService(config, {} as GoogleMailService);
    const credentials = service.credentials({
      email: 'sender@example.com',
      smtp_host: host,
      smtp_port: 465,
      smtp_user: 'sender@example.com',
      smtp_secret: service.encrypt('abcd efgh ijkl mnop'),
    });
    expect(credentials.pass).toBe(expected);
  });

  it('stores a different ciphertext and recovers the SMTP secret', () => {
    const config = {
      get: (key: string) =>
        key === 'SMTP_ENCRYPTION_KEY' ? 'ab'.repeat(32) : undefined,
    } as unknown as ConfigService;
    const service = new SmtpService(config, {} as GoogleMailService);
    const encrypted = service.encrypt('local-test-secret');
    expect(encrypted).not.toContain('local-test-secret');
    expect(
      service.credentials({
        email: 'sender@example.com',
        smtp_host: 'localhost',
        smtp_port: 465,
        smtp_user: 'sender@example.com',
        smtp_secret: encrypted,
      }),
    ).toEqual({ user: 'sender@example.com', pass: 'local-test-secret' });
  });
});

describe('SmtpService campaign HTML', () => {
  it('sends the image as an inline CID attachment and renders the button', async () => {
    const sendMail = jest.fn((message: unknown) => {
      void message;
      return Promise.resolve({
        accepted: ['recipient@example.com'],
        messageId: '<sent@example.com>',
      });
    });
    jest.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
    const config = {
      get: (key: string) =>
        key === 'SMTP_ENCRYPTION_KEY' ? '1'.repeat(64) : undefined,
    } as unknown as ConfigService;
    const smtp = new SmtpService(config, {} as GoogleMailService);
    const account = {
      email: 'sender@example.com',
      smtp_host: 'localhost',
      smtp_port: 465,
      smtp_user: 'sender',
      smtp_secret: smtp.encrypt('test-password'),
    };
    await smtp.send(
      account,
      'recipient@example.com',
      'Subject',
      'Chào {{Họ tên}} [[Hình ảnh:7]][[Nút:Xem thêm|https://example.com]]',
      [
        {
          id: '7',
          kind: 'image',
          file_name: 'picture.png',
          content_type: 'image/png',
          content: Buffer.from('image'),
        },
        {
          id: '8',
          kind: 'image',
          file_name: 'unused.png',
          content_type: 'image/png',
          content: Buffer.from('unused'),
        },
      ],
      (value) => value.replaceAll('{{Họ tên}}', 'An'),
    );
    const message = sendMail.mock.calls[0][0] as {
      html: string;
      text: string;
      attachments: { cid: string }[];
    };
    expect(message.html).toContain('cid:v5-image-7');
    expect(message.html).toContain('Chào An');
    expect(message.html).toContain('https://example.com');
    expect(message.text).toContain('Xem thêm: https://example.com');
    expect(message.attachments[0].cid).toBe('v5-image-7');
    expect(message.attachments).toHaveLength(1);
  });
});
