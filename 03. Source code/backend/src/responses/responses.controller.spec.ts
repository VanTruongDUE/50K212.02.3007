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
