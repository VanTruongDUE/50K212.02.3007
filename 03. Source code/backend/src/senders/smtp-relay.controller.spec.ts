import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { GoogleMailService } from './google-mail.service';
import { SmtpService } from './smtp.service';
import { SmtpRelayController } from './smtp-relay.controller';

const id = '12345678-1234-4234-8234-123456789012';
describe('SMTP relay', () => {
  const config = {
    get: (key: string) =>
      ({
        REMOTE_SMTP_URL: 'https://relay.example',
        SMTP_RELAY_SECRET: 'secret',
      })[key],
  } as ConfigService;
  afterEach(() => jest.restoreAllMocks());
  it('sends only a one-use request ID over HTTP and serializes attachments in shared storage', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: ['to@example.invalid'],
          messageId: 'sent',
        }),
      ),
    );
    const service = new SmtpService(
      config,
      {} as GoogleMailService,
      { query } as unknown as DatabaseService,
    );
    expect(
      await service.send(
        {
          email: 'sender@example.invalid',
          smtp_host: null,
          smtp_port: null,
          smtp_user: null,
          smtp_secret: null,
        },
        'to@example.invalid',
        'Subject',
        'Body',
        [
          {
            id: '1',
            kind: 'pdf',
            file_name: 'a.pdf',
            content_type: 'application/pdf',
            content: Buffer.from('abc'),
          },
        ],
      ),
    ).toBe('sent');
    const insert = query.mock.calls.find((call: unknown[]) =>
      String(call[0]).startsWith('INSERT'),
    ) as [
      string,
      [string, string, string, { attachments: { content: string }[] }],
    ];
    expect(insert[1][3].attachments[0].content).toBe('YWJj');
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      requestId: string;
    };
    expect(Object.keys(body)).toEqual(['requestId']);
    expect(query).toHaveBeenLastCalledWith(
      'DELETE FROM smtp_relay_requests WHERE id=$1',
      [body.requestId],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry an uncertain network failure and removes pending payload', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('private network details'));
    const service = new SmtpService(
      config,
      {} as GoogleMailService,
      { query } as unknown as DatabaseService,
    );
    await expect(
      service.verify({
        email: 'sender@example.invalid',
        smtp_host: null,
        smtp_port: null,
        smtp_user: null,
        smtp_secret: null,
      }),
    ).rejects.toThrow('tránh gửi trùng');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith(
      'DELETE FROM smtp_relay_requests WHERE id=$1',
      [expect.any(String)],
    );
  });
  it('rejects invalid relay authorization before DB access', async () => {
    const query = jest.fn();
    const controller = new SmtpRelayController(
      config,
      { query } as unknown as DatabaseService,
      {} as SmtpService,
    );
    await expect(
      controller.run('send', { requestId: id }, 'Bearer wrong'),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it('consumes the stored request and loads SMTP credentials only from DB; duplicate IDs cannot send twice', async () => {
    const account = { email: 'sender@example.invalid' };
    const mail = {
      to: 'to@example.invalid',
      subject: 'Subject',
      text: 'Body',
      html: 'Body',
      attachments: [],
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ account_email: account.email, mail }] })
      .mockResolvedValueOnce({ rows: [account] })
      .mockResolvedValueOnce({ rows: [] });
    const relay = jest
      .fn()
      .mockResolvedValue({ messageId: 'sent', accepted: [mail.to] });
    const controller = new SmtpRelayController(
      config,
      { query } as unknown as DatabaseService,
      { relay } as unknown as SmtpService,
    );
    await controller.run('send', { requestId: id }, 'Bearer secret');
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM smtp_relay_requests'),
      [id, 'send'],
    );
    expect(relay).toHaveBeenCalledWith(account, 'send', mail);
    await expect(
      controller.run('send', { requestId: id }, 'Bearer secret'),
    ).rejects.toThrow('already consumed');
    expect(relay).toHaveBeenCalledTimes(1);
  });
});
