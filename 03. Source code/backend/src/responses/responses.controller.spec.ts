import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import { SmtpService } from '../senders/smtp.service';
import { ResponsesController } from './responses.controller';

describe('Response status notes', () => {
  const request = {
    account: { id: 'employee', role: 'employee' },
  } as AuthenticatedRequest;
  const item = {
    id: '1',
    assignee_id: 'employee',
    contact_id: null,
    customer_name: 'Customer',
    email: '',
    phone: '',
    content: 'Response',
    kind: 'interested',
    status: 'new',
    hidden_at: null,
  };
  let query: jest.Mock;
  let connect: jest.Mock;
  let release: jest.Mock;
  let controller: ResponsesController;

  beforeEach(() => {
    query = jest.fn().mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.startsWith('UPDATE responses')
          ? [{ ...item, status: 'processing' }]
          : [],
      }),
    );
    release = jest.fn();
    connect = jest.fn().mockResolvedValue({ query, release });
    controller = new ResponsesController(
      {
        query: jest.fn().mockResolvedValue({ rows: [item] }),
        connect,
      } as unknown as DatabaseService,
      {} as SmtpService,
    );
  });

  it.each([100, null, 'a'.repeat(1001)])(
    'rejects invalid note before writing (%p)',
    async (note) => {
      await expect(
        controller.update(1, { status: 'processing', note }, request),
      ).rejects.toThrow('Ghi chú trạng thái');
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('writes the note in the same transaction as the status change', async () => {
    await controller.update(
      1,
      { status: 'processing', note: '  Called customer  ' },
      request,
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'response_status_history(response_id,actor_id,from_status,to_status,note)',
      ),
      [1, 'employee', 'new', 'processing', 'Called customer'],
    );
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });

  it('rolls back the status change when saving its note fails', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith('INSERT INTO response_status_history'))
        return Promise.reject(new Error('history unavailable'));
      return Promise.resolve({
        rows: sql.startsWith('UPDATE responses')
          ? [{ ...item, status: 'processing' }]
          : [],
      });
    });
    await expect(
      controller.update(1, { status: 'processing', note: 'Called' }, request),
    ).rejects.toThrow('history unavailable');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
});

describe('Response automatic email reply', () => {
  const request = {
    account: { id: 'employee', role: 'employee' },
  } as AuthenticatedRequest;
  const account = { id: '2', quota_3_days: 100, quota_hourly: 10 };
  let campaign:
    | {
        sender_account_id: string | null;
        subject: string | null;
        full_name?: string;
        company?: string;
      }
    | undefined;
  let kind: string;
  let hourly: number;
  let query: jest.Mock;
  let send: jest.Mock;
  let controller: ResponsesController;

  beforeEach(() => {
    campaign = { sender_account_id: '2', subject: 'Giới thiệu giải pháp' };
    kind = 'need_info';
    hourly = 0;
    query = jest.fn().mockImplementation((sql: string) => {
      let rows: unknown[] = [];
      if (sql.startsWith('SELECT * FROM responses'))
        rows = [{ email: 'recipient@example.com', kind }];
      else if (sql.startsWith('SELECT c.sender_account_id'))
        rows = campaign ? [campaign] : [];
      else if (sql.startsWith('SELECT * FROM sender_accounts'))
        rows = [account];
      else if (sql.includes('AS hourly'))
        rows = [{ used: '0', hourly: String(hourly) }];
      else if (sql.startsWith('INSERT INTO response_email_deliveries'))
        rows = [{ id: '10' }];
      else if (sql.startsWith('SELECT status FROM responses'))
        rows = [{ status: 'new' }];
      return Promise.resolve({ rows, rowCount: rows.length });
    });
    send = jest.fn().mockResolvedValue('message-id');
    controller = new ResponsesController(
      {
        connect: jest.fn().mockResolvedValue({ query, release: jest.fn() }),
      } as unknown as DatabaseService,
      { send } as unknown as SmtpService,
    );
  });

  it('uses the campaign sender and subject when the form sends only content', async () => {
    await controller.reply(1, { content: 'Thông tin bổ sung' }, request);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY id LIMIT 1 FOR UPDATE'),
      ['2'],
    );
    expect(send).toHaveBeenCalledWith(
      account,
      'recipient@example.com',
      'Re: Giới thiệu giải pháp',
      'Thông tin bổ sung',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO response_interactions'),
      [1, 'employee', 'Thông tin bổ sung'],
    );
  });

  it('uses a configured active account and Response subject for an offline Response', async () => {
    campaign = undefined;
    await controller.reply(1, { content: 'Thông tin bổ sung' }, request);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY id LIMIT 1 FOR UPDATE'),
      [null],
    );
    expect(send).toHaveBeenCalledWith(
      account,
      'recipient@example.com',
      'Phản hồi RSP-1',
      'Thông tin bổ sung',
    );
  });

  it('preserves explicit sender and subject for existing API callers', async () => {
    await controller.reply(
      1,
      { senderAccountId: 2, subject: 'Báo giá', content: 'Thông tin bổ sung' },
      request,
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('SELECT c.sender_account_id'),
      expect.anything(),
    );
    expect(send).toHaveBeenCalledWith(
      account,
      'recipient@example.com',
      'Báo giá',
      'Thông tin bổ sung',
    );
  });

  it('fills supported campaign subject variables using the linked Contact', async () => {
    campaign = {
      sender_account_id: '2',
      subject: 'Mời {{Họ tên}} tại {{Tên doanh nghiệp}}',
      full_name: 'An Phú',
      company: 'V5',
    };
    await controller.reply(1, { content: 'Thông tin bổ sung' }, request);
    expect(send).toHaveBeenCalledWith(
      account,
      'recipient@example.com',
      'Re: Mời An Phú tại V5',
      'Thông tin bổ sung',
    );
  });

  it.each([
    { senderAccountId: null },
    { senderAccountId: '2' },
    { subject: '' },
    { subject: null },
    { content: '' },
  ])(
    'rejects malformed reply fields before connecting (%p)',
    async (fields) => {
      await expect(
        controller.reply(
          1,
          { content: 'Thông tin bổ sung', ...fields },
          request,
        ),
      ).rejects.toThrow('không hợp lệ');
      expect(query).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('still enforces the hourly quota before sending an automatic reply', async () => {
    hourly = 10;
    await expect(
      controller.reply(1, { content: 'Thông tin bổ sung' }, request),
    ).rejects.toThrow('hạn mức giờ');
    expect(send).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('still blocks an unsubscribe Response', async () => {
    kind = 'unsubscribe';
    await expect(
      controller.reply(1, { content: 'Thông tin bổ sung' }, request),
    ).rejects.toThrow('Không thể gửi email');
    expect(send).not.toHaveBeenCalled();
  });
});
