import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { SmtpService } from '../senders/smtp.service';
import { DeliveryWorker } from './delivery.worker';

describe('DeliveryWorker skipped recipients', () => {
  it('finishes a skipped campaign on its existing client while the scheduler holds the other pool slot', async () => {
    const job = {
      campaign_id: '1',
      contact_id: '2',
      recipient_email: 'recipient@example.invalid',
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [job] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValue({});
    const release = jest.fn();
    const databaseQuery = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValue(new Error('No third pool connection available'));
    const database = {
      query: databaseQuery,
      connect: jest.fn().mockResolvedValue({ query, release }),
    };
    const smtp = { send: jest.fn() };
    const worker = new DeliveryWorker(
      database as unknown as DatabaseService,
      smtp as unknown as SmtpService,
      { get: () => 'https://example.invalid' } as unknown as ConfigService,
    );

    await worker.tick();

    expect(databaseQuery).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE campaigns SET status='completed'"),
      ['1'],
    );
    expect(release).toHaveBeenCalledTimes(1);
    expect(smtp.send).not.toHaveBeenCalled();
  });
});

describe('DeliveryWorker shared hourly limit', () => {
  it('does not reserve or send when replies have exhausted the sender hourly quota', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            campaign_id: '1',
            contact_id: '2',
            account_id: '3',
            recipient_email: 'recipient@example.invalid',
            quota_3_days: 100,
            quota_hourly: 2,
            send_rate: 50,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ used: '2', hourly: '2' }] })
      .mockResolvedValue({});
    const release = jest.fn();
    const smtp = { send: jest.fn() };
    const worker = new DeliveryWorker(
      {
        query: jest.fn().mockResolvedValue({}),
        connect: jest.fn().mockResolvedValue({ query, release }),
      } as unknown as DatabaseService,
      smtp as unknown as SmtpService,
      { get: () => 'https://example.invalid' } as unknown as ConfigService,
    );
    await worker.tick();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'UNION ALL SELECT state,created_at,sent_at FROM response_email_deliveries',
      ),
      ['3'],
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO email_deliveries'),
      expect.anything(),
    );
    expect(smtp.send).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
