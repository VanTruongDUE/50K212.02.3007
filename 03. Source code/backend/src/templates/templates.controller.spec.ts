import { DatabaseService } from '../database/database.service';
import { TemplatesController } from './templates.controller';
import type { AuthenticatedRequest } from '../auth/session.guard';

describe('Template application campaign state', () => {
  it.each(['draft', 'pending_approval', 'rejected'])(
    'explains approval for %s without loading or copying a template',
    async (status) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '1', status }] })
        .mockResolvedValue({});
      const release = jest.fn();
      const controller = new TemplatesController({
        connect: jest.fn().mockResolvedValue({ query, release }),
      } as unknown as DatabaseService);
      await expect(
        controller.apply(1, { campaignId: 1 }, {
          account: { id: 'NV001', role: 'employee' },
        } as AuthenticatedRequest),
      ).rejects.toThrow('chưa được Trưởng phòng duyệt');
      expect(query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(query).not.toHaveBeenCalledWith(
        expect.stringContaining('FROM email_templates'),
        expect.anything(),
      );
      expect(release).toHaveBeenCalledTimes(1);
    },
  );
});
