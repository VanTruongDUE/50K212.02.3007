import { DatabaseService } from '../database/database.service';
import { FollowupWorker } from './followup.worker';

describe('Follow-up result and maximum attempts', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    { attempt: 1, incoming: false, expected: 'no_response', next: true },
    { attempt: 2, incoming: false, expected: 'no_response', next: false },
    { attempt: 2, incoming: true, expected: 'responded', next: false },
  ])(
    'resolves attempt $attempt/2 with incoming=$incoming',
    async ({ attempt, incoming, expected, next }) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-15T03:00:00Z'));
      const item = {
        id: '10',
        response_id: '20',
        assignee_id: 'NV001',
        attempt,
        max_attempts: 2,
        completed_at: new Date('2026-11-13T03:00:00Z'),
        wait_days: 1,
        needs_next: true,
        channel: 'phone',
        goal: 'Tư vấn',
        reminder_minutes: 60,
        interval_days: 2,
      };
      const client = {
        query: jest.fn((sql: string, values?: unknown[]) => {
          void values;
          if (sql.startsWith('SELECT * FROM followups'))
            return { rows: [item], rowCount: 1 };
          if (sql.startsWith('SELECT email,kind,status'))
            return {
              rows: [
                {
                  email: 'customer@example.invalid',
                  kind: 'interested',
                  status: 'processing',
                },
              ],
              rowCount: 1,
            };
          if (sql.startsWith('SELECT 1 FROM responses'))
            return { rows: incoming ? [{}] : [], rowCount: incoming ? 1 : 0 };
          return { rows: [], rowCount: 0 };
        }),
        release: jest.fn(),
      };
      const database = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: item.id }] }),
        connect: jest.fn().mockResolvedValue(client),
      };
      await new FollowupWorker(database as unknown as DatabaseService).tick();
      expect(client.query).toHaveBeenCalledWith(
        'UPDATE followups SET outcome=$2,resolved_at=now(),worker_error=NULL,worker_error_stage=NULL WHERE id=$1',
        [item.id, expected],
      );
      const inserts = client.query.mock.calls.filter(([sql]) =>
        sql.includes('INSERT INTO followups'),
      );
      expect(inserts).toHaveLength(next ? 1 : 0);
      if (next) expect(inserts[0][1]?.[3]).toBe(2);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['result', 'chain'])(
    'keeps the transaction intact and exposes a safe %s failure for the interface',
    async (stage) => {
      const item = {
        id: '10',
        response_id: '20',
        assignee_id: 'NV001',
        attempt: 1,
        max_attempts: 2,
        completed_at: new Date('2020-01-01'),
        wait_days: 1,
        needs_next: true,
        interval_days: 2,
      };
      const client = {
        query: jest.fn((sql: string) => {
          if (sql.startsWith('SELECT * FROM followups'))
            return { rows: [item], rowCount: 1 };
          if (sql.startsWith('SELECT email,kind,status'))
            return {
              rows: [
                {
                  email: 'test@example.invalid',
                  status: 'processing',
                  kind: 'interested',
                },
              ],
              rowCount: 1,
            };
          if (sql.startsWith('SELECT 1 FROM responses'))
            return { rows: [], rowCount: 0 };
          if (
            (stage === 'result' &&
              sql.startsWith('UPDATE followups SET outcome')) ||
            (stage === 'chain' && sql.includes('INSERT INTO followups'))
          )
            throw new Error('internal database details must remain private');
          return { rows: [], rowCount: 0 };
        }),
        release: jest.fn(),
      };
      const query = jest.fn().mockResolvedValue({ rows: [{ id: '10' }] });
      await new FollowupWorker({
        query,
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as DatabaseService).tick();
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.query).not.toHaveBeenCalledWith('COMMIT');
      const failureArgs = query.mock.calls[1] as [string, unknown[]];
      expect(failureArgs[1][2]).toBe(stage);
      expect(failureArgs[1][1]).not.toContain('internal database');
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );
});
