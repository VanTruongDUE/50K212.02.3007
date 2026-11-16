import { DatabaseService } from '../database/database.service';
import { SendersController } from './senders.controller';
import { SmtpService } from './smtp.service';

describe('SendersController SMTP verification', () => {
  it('exposes daily usage and the 80 percent warning while preserving legacy clients', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ id: '1', quota_3_days: 100, quota_daily: 100, used_today: 80 }],
    });
    const controller = new SendersController(
      { query } as unknown as DatabaseService,
      {} as SmtpService,
    );
    const rows = await controller.list({
      account: { role: 'manager' },
    } as Parameters<SendersController['list']>[0]);
    expect(rows[0]).toMatchObject({
      quota_daily: 100,
      used_today: 80,
      used_3_days: 80,
      quota_warning: true,
    });
  });

  it.each(['quotaDaily', 'quota3Days'])(
    'accepts %s as the configured daily limit',
    async (field) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: '1' }] })
        .mockResolvedValueOnce({
          rows: [{ quota_3_days: 25, quota_daily: 25, used_today: 0 }],
        });
      const controller = new SendersController(
        { query } as unknown as DatabaseService,
        {} as SmtpService,
      );
      const result = await controller.create({
        name: 'Marketing',
        email: 'marketing@example.com',
        status: 'inactive',
        [field]: 25,
      });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sender_accounts'),
        expect.arrayContaining([25]),
      );
      expect(result).toMatchObject({
        quota_daily: 25,
        used_today: 0,
        quota_warning: false,
      });
    },
  );

  it.each([
    ['EAUTH', 'từ chối xác thực SMTP'],
    ['ETIMEDOUT', 'Không thể kết nối'],
  ])('reports %s without exposing provider details', async (code, message) => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: '164' }] }),
    } as unknown as DatabaseService;
    const smtp = {
      verify: jest.fn().mockRejectedValue({
        code,
        response: 'private-provider-details',
      }),
    } as unknown as SmtpService;
    const controller = new SendersController(database, smtp);
    await expect(controller.verify(164)).rejects.toThrow(message);
    await expect(controller.verify(164)).rejects.not.toThrow(
      'private-provider-details',
    );
  });
});

describe('Sender profile hourly quota', () => {
  const profile = {
    name: 'Marketing',
    code: 'MKT01',
    email: 'marketing@example.com',
    quotaDaily: 25,
  };
  it.each([0, 26, 1.5, '10'])(
    'rejects hourly quota %p before writing',
    async (quotaHourly) => {
      const query = jest.fn();
      const controller = new SendersController(
        { query } as unknown as DatabaseService,
        {} as SmtpService,
      );
      await expect(
        controller.create({ ...profile, quotaHourly }),
      ).rejects.toThrow('không hợp lệ');
      expect(query).not.toHaveBeenCalled();
    },
  );
  it('creates an inactive profile without SMTP credentials and persists the hourly limit', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            quota_daily: 25,
            quota_hourly: 10,
            used_today: 0,
            status: 'inactive',
          },
        ],
      });
    const controller = new SendersController(
      { query } as unknown as DatabaseService,
      {} as SmtpService,
    );
    await expect(
      controller.create({ ...profile, quotaHourly: 10 }),
    ).resolves.toMatchObject({ quota_hourly: 10, status: 'inactive' });
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO sender_accounts'),
      [
        'Marketing',
        'marketing@example.com',
        'inactive',
        25,
        null,
        null,
        null,
        null,
        false,
        'MKT01',
        10,
      ],
    );
  });
  it('refuses deletion when a sender is referenced instead of losing history', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({ rowCount: 0 });
    const controller = new SendersController(
      { query } as unknown as DatabaseService,
      {} as SmtpService,
    );
    await expect(controller.remove(1)).rejects.toThrow(
      'Lịch sử gửi được giữ nguyên',
    );
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('FROM inbound_messages'),
      [1],
    );
  });
});
