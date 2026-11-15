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
