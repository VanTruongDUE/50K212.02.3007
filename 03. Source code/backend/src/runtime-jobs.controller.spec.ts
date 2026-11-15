import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database/database.service';
import { DeliveryWorker } from './campaigns/delivery.worker';
import { FollowupWorker } from './followups/followup.worker';
import { InboxService } from './inbox/inbox.service';
import { SearchService } from './search/search.service';
import { RuntimeJobsController } from './runtime-jobs.controller';

describe('RuntimeJobsController', () => {
  it('exposes the existing API namespace', () => {
    expect(Reflect.getMetadata(PATH_METADATA, RuntimeJobsController)).toBe(
      'api/internal/jobs',
    );
  });
  let secret: string | undefined;
  let acquired: boolean;
  let controller: RuntimeJobsController;
  const query = jest.fn();
  const release = jest.fn();
  const connect = jest.fn();
  const databaseQuery = jest.fn();
  const delivery = jest.fn();
  const inbox = jest.fn();
  const followups = jest.fn();
  const search = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    secret = 'private-test-secret';
    acquired = true;
    query.mockImplementation((sql: string) =>
      Promise.resolve({ rows: sql.startsWith('SELECT') ? [{ acquired }] : [] }),
    );
    connect.mockResolvedValue({ query, release });
    controller = new RuntimeJobsController(
      { get: () => secret } as unknown as ConfigService,
      { connect, query: databaseQuery } as unknown as DatabaseService,
      { tick: delivery } as unknown as DeliveryWorker,
      { syncAll: inbox } as unknown as InboxService,
      { tick: followups } as unknown as FollowupWorker,
      { tick: search } as unknown as SearchService,
    );
  });

  it.each([undefined, '', 'Bearer wrong', 'private-test-secret'])(
    'rejects invalid authorization %s before database access',
    async (header) => {
      await expect(controller.run('delivery', header)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', '   '])(
    'fails closed without a configured secret',
    async (value) => {
      secret = value;
      await expect(
        controller.run('delivery', 'Bearer private-test-secret'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown and inherited task names', async () => {
    for (const name of ['unknown', 'toString', '__proto__']) {
      await expect(
        controller.run(name, 'Bearer private-test-secret'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(['delivery', 'inbox', 'followups', 'search'])(
    'awaits %s and releases the transaction lock',
    async (task) => {
      const workers = { delivery, inbox, followups, search };
      await expect(
        controller.run(task, 'Bearer private-test-secret'),
      ).resolves.toEqual({ ok: true, skipped: false });
      expect(workers[task]).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired',
        [8152026, 0],
      );
      expect(query).toHaveBeenLastCalledWith('COMMIT');
      expect(release).toHaveBeenCalledTimes(1);
    },
  );

  it('skips an overlapping invocation and releases its connection', async () => {
    acquired = false;
    await expect(
      controller.run('delivery', 'Bearer private-test-secret'),
    ).resolves.toEqual({ ok: true, skipped: true });
    expect(delivery).not.toHaveBeenCalled();
    expect(databaseQuery).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('pauses only stale uncertain deliveries before dispatch without marking them failed or retrying', async () => {
    await controller.run('delivery', 'Bearer private-test-secret');
    const [sql, params] = databaseQuery.mock.calls[0] as [string, string[]];
    expect(sql).toContain("status IN ('scheduled','sending')");
    expect(sql).toContain(
      "state='sending' AND created_at < now()-interval '10 minutes'",
    );
    expect(sql).toContain("status='paused'");
    expect(sql).toContain('pause_reason=$1');
    expect(sql).not.toMatch(
      /UPDATE email_deliveries|state='failed'|status='pending'/,
    );
    expect(params[0]).toContain('tránh gửi trùng');
    expect(databaseQuery.mock.invocationCallOrder[0]).toBeLessThan(
      delivery.mock.invocationCallOrder[0],
    );
  });

  it.each(['inbox', 'followups', 'search'])(
    'does not recover deliveries during %s',
    async (task) => {
      await controller.run(task, 'Bearer private-test-secret');
      expect(databaseQuery).not.toHaveBeenCalled();
    },
  );

  it('does not send when stale recovery fails and releases its lock', async () => {
    databaseQuery.mockRejectedValueOnce(new Error('recovery unavailable'));
    await expect(
      controller.run('delivery', 'Bearer private-test-secret'),
    ).rejects.toThrow('recovery unavailable');
    expect(delivery).not.toHaveBeenCalled();
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases when a task throws', async () => {
    search.mockRejectedValue(new Error('search unavailable'));
    await expect(
      controller.run('search', 'Bearer private-test-secret'),
    ).rejects.toThrow('search unavailable');
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases when lock acquisition fails', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      controller.run('delivery', 'Bearer private-test-secret'),
    ).rejects.toThrow('database unavailable');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
