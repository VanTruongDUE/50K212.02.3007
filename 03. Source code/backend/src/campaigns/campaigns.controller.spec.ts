import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { CampaignsController } from './campaigns.controller';
import { DeliveryWorker } from './delivery.worker';

describe('Campaign confirmation', () => {
  it.each(['now', 'scheduled'])(
    'starts delivery only for %s mode',
    async (sendMode) => {
      const campaign = {
        id: '1',
        owner_id: 'NV001',
        status: 'approved',
        subject: 'Subject',
        body: 'Body',
        sender_account_id: '2',
        scheduled_at: new Date(),
        send_mode: sendMode,
      };
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [campaign] })
        .mockResolvedValueOnce({ rows: [{ previewed_at: new Date() }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ ...campaign, status: 'scheduled' }],
        });
      const tick = jest.fn().mockResolvedValue(undefined);
      const controller = new CampaignsController(
        { query } as unknown as DatabaseService,
        { get: () => 'https://example.test' } as unknown as ConfigService,
        { tick } as unknown as DeliveryWorker,
      );
      const request = {
        account: { id: 'NV001', role: 'employee' },
      } as AuthenticatedRequest;

      await controller.confirm(1, request);

      expect(tick).toHaveBeenCalledTimes(sendMode === 'now' ? 1 : 0);
    },
  );
});
