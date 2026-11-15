import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { CampaignsController } from './campaigns.controller';
import { DeliveryWorker } from './delivery.worker';
import { NotFoundException } from '@nestjs/common';

describe('Campaign detail approval provenance', () => {
  it('returns each linked list approval time without choosing the first one', async () => {
    const campaign = { id: '1', owner_id: 'NV001', status: 'approved' };
    const lists = [
      {
        id: '3',
        name: 'First',
        reviewed_at: '2026-11-14T01:00:00Z',
        reviewed_by: 'TP001',
        manager_review: 'approved',
      },
      {
        id: '4',
        name: 'Second',
        reviewed_at: '2026-11-15T01:00:00Z',
        reviewed_by: 'TP002',
        manager_review: 'approved',
      },
    ];
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [campaign] })
      .mockResolvedValueOnce({ rows: lists })
      .mockResolvedValueOnce({ rows: [] });
    const controller = new CampaignsController(
      { query } as unknown as DatabaseService,
      {} as ConfigService,
      {} as DeliveryWorker,
    );
    const request = {
      account: { id: 'NV001', role: 'employee' },
    } as AuthenticatedRequest;

    expect(await controller.detail(1, request)).toEqual({
      ...campaign,
      lists,
      recipients: [],
    });
    const calls = query.mock.calls as [string, unknown[]][];
    expect(calls[0][1]).toEqual([1, 'employee', 'NV001']);
    expect(calls[1][0]).toContain(
      'l.reviewed_at,l.reviewed_by,l.manager_review',
    );
  });

  it('does not load linked-list approvals for an inaccessible campaign', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const controller = new CampaignsController(
      { query } as unknown as DatabaseService,
      {} as ConfigService,
      {} as DeliveryWorker,
    );
    const request = {
      account: { id: 'NV002', role: 'employee' },
    } as AuthenticatedRequest;

    await expect(controller.detail(1, request)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});

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
        scheduled_at: new Date(
          Date.parse(new Date().toISOString().slice(0, 10) + 'T02:00:00Z') +
            86400000,
        ),
        send_mode: sendMode,
      };
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [campaign] })
        .mockResolvedValueOnce({ rows: [{ previewed_at: new Date() }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ remaining: '100', pending: '1' }] })
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

  it('rejects a schedule that expired while the confirmation page was open', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          id: '1',
          owner_id: 'NV001',
          status: 'approved',
          send_mode: 'scheduled',
          scheduled_at: new Date(Date.now() + 60000),
        },
      ],
    });
    const controller = new CampaignsController(
      { query } as unknown as DatabaseService,
      {} as ConfigService,
      {} as DeliveryWorker,
    );
    await expect(
      controller.confirm(1, {
        account: { id: 'NV001', role: 'employee' },
      } as AuthenticatedRequest),
    ).rejects.toThrow('Lịch gửi không còn hợp lệ');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps a paused campaign paused when the sender lacks quota', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [{ status: 'paused', sender_account_id: '2' }],
      })
      .mockResolvedValueOnce({ rows: [{ remaining: '1', pending: '2' }] });
    const controller = new CampaignsController(
      { query } as unknown as DatabaseService,
      {} as ConfigService,
      {} as DeliveryWorker,
    );
    const request = {
      account: { id: 'NV001', role: 'employee' },
    } as AuthenticatedRequest;

    await expect(controller.resume(1, request)).rejects.toThrow(
      'không đủ hạn mức',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
});
