import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { DatabaseService } from '../database/database.service';
import { ContactsController } from './contacts.controller';

const employee = {
  account: { id: 'NV001', role: 'employee' },
} as AuthenticatedRequest;
const manager = {
  account: { id: 'TP001', role: 'manager' },
} as AuthenticatedRequest;
const search = {
  search_id: '9',
  search_started_at: '2026-11-15T01:00:00Z',
  search_finished_at: '2026-11-15T01:01:00Z',
  search_received: 10,
  search_invalid: 2,
  search_duplicate: 3,
  search_new_count: 5,
};

describe('Contact list provenance', () => {
  it.each([employee, manager])(
    'returns original search counts for an authorized detail',
    async (request) => {
      const row = { id: '1', owner_id: employee.account.id, ...search };
      const contacts = [{ id: '1', email: 'one@example.invalid' }];
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: contacts });
      const controller = new ContactsController({
        query,
      } as unknown as DatabaseService);

      const detail = await controller.detail(1, request);

      expect(detail).toEqual({ ...row, contacts });
      expect(detail.search_received).toBe(10);
      expect(detail.contacts).toHaveLength(1);
      expect(query.mock.calls[0][0]).toMatch(/LEFT JOIN LATERAL/);
      expect(query.mock.calls[0][0]).toContain(
        'j.list_id=l.id AND j.owner_id=l.owner_id',
      );
      expect(query.mock.calls[0][1]).toEqual([1]);
    },
  );

  it('keeps manual-list provenance null and preserves the employee list scope', async () => {
    const manual = {
      id: '2',
      owner_id: employee.account.id,
      contact_count: 2,
      ...Object.fromEntries(Object.keys(search).map((key) => [key, null])),
    };
    const query = jest.fn().mockResolvedValue({ rows: [manual] });
    const controller = new ContactsController({
      query,
    } as unknown as DatabaseService);

    expect(await controller.list(employee)).toEqual([manual]);
    expect(query.mock.calls[0][0]).toMatch(/LEFT JOIN LATERAL/);
    expect(query.mock.calls[0][0]).toContain(
      'j.list_id=l.id AND j.owner_id=l.owner_id',
    );
    expect(query.mock.calls[0][0]).toContain(
      "WHERE $1 = 'manager' OR l.owner_id = $2",
    );
    expect(query.mock.calls[0][1]).toEqual(['employee', 'NV001']);
  });

  it('rejects another employee list before loading its contacts', async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ id: '1', owner_id: 'NV002', ...search }] });
    const controller = new ContactsController({
      query,
    } as unknown as DatabaseService);

    await expect(controller.detail(1, employee)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps missing detail recovery', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const controller = new ContactsController({
      query,
    } as unknown as DatabaseService);

    await expect(controller.detail(99, manager)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
