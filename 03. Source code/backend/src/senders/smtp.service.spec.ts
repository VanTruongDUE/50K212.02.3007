import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { SmtpService } from './smtp.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

describe('SmtpService', () => {
  it('stores a different ciphertext and recovers the SMTP secret', () => {
    const config = { get: () => 'ab'.repeat(32) } as unknown as ConfigService;
    const service = new SmtpService(config);
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
    const smtp = new SmtpService(config);
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
