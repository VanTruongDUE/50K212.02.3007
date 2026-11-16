import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../auth/session.guard';
import { CampaignsController, fill } from './campaigns.controller';
import { DeliveryWorker } from './delivery.worker';
import { SmtpService } from '../senders/smtp.service';
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
      {} as SmtpService,
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
      {} as SmtpService,
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
        {} as SmtpService,
      );
      const request = {
        account: { id: 'NV001', role: 'employee' },
      } as AuthenticatedRequest;

      await controller.confirm(1, request);

      expect(tick).toHaveBeenCalledTimes(sendMode === 'now' ? 1 : 0);
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining(
          "scheduled_at=CASE WHEN send_mode='now' THEN now() ELSE scheduled_at END",
        ),
        [1],
      );
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
      {} as SmtpService,
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
      {} as SmtpService,
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

describe('Campaign review and preview safeguards', () => {
  const request = {
    account: { id: 'NV001', role: 'employee' },
  } as AuthenticatedRequest;
  it.each(['pending_approval', 'rejected'])(
    'blocks all preparation writes before campaign recipients are approved (%s)',
    async (status) => {
      const query = jest
        .fn()
        .mockResolvedValue({ rows: [{ id: '1', owner_id: 'NV001', status }] });
      const controller = new CampaignsController(
        { query } as unknown as DatabaseService,
        {} as ConfigService,
        {} as DeliveryWorker,
        {} as SmtpService,
      );
      await expect(
        controller.content(1, { subject: 'Test', body: 'Body' }, request),
      ).rejects.toThrow('không ở bước chuẩn bị');
      await expect(
        controller.sender(1, { senderAccountId: 1 }, request),
      ).rejects.toThrow('không ở bước chuẩn bị');
      await expect(
        controller.schedule(1, { sendNow: true }, request),
      ).rejects.toThrow('không ở bước chuẩn bị');
      expect(query).toHaveBeenCalledTimes(3);
    },
  );
  it('keeps missing personalization visible and does not erase surrounding text', () => {
    expect(
      fill('Kính gửi {{Họ tên}}, tại {{Tên doanh nghiệp}}.', null, ''),
    ).toBe('Kính gửi {{Họ tên}}, tại {{Tên doanh nghiệp}}.');
    expect(fill('Chào {{Họ tên}}, {{Chức vụ}}', ' Lan ', 'V5')).toBe(
      'Chào Lan, {{Chức vụ}}',
    );
  });
});

describe('Campaign schedule sender hourly limit', () => {
  it('persists the effective rate so schedule estimates cannot exceed the account cap', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            owner_id: 'NV001',
            status: 'approved',
            sender_account_id: '3',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ quota_hourly: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: '1', send_rate: 10 }] });
    const controller = new CampaignsController(
      { query } as unknown as DatabaseService,
      {} as ConfigService,
      {} as DeliveryWorker,
      {} as SmtpService,
    );
    const request = {
      account: { id: 'NV001', role: 'employee' },
    } as AuthenticatedRequest;
    await expect(
      controller.schedule(1, { sendNow: true, rate: 50 }, request),
    ).resolves.toMatchObject({ send_rate: 10 });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE campaigns SET'),
      [1, expect.any(Date), 'now', 10, '08:00', '17:00'],
    );
  });
});

describe('Preview variable validity from UC5.2.1', () => {
  it.each([
    ['Mời {{Họ tên}}', 'Xin chào {{Tên doanh nghiệp}}', []],
    ['Mời {{Sai}}', 'Xin chào {{Chua dong', ['{{Sai}}', '{{Chua dong']],
  ])(
    'validates supported syntax without treating absent Contact fields as errors',
    async (subject, body, errors) => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { id: '1', owner_id: 'NV001', status: 'paused', subject, body },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: '2', full_name: null, company: null }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const controller = new CampaignsController(
        { query } as unknown as DatabaseService,
        {} as ConfigService,
        {} as DeliveryWorker,
        {} as SmtpService,
      );
      const result = await controller.preview(1, {}, {
        account: { id: 'NV001', role: 'employee' },
      } as AuthenticatedRequest);
      expect(result.variable_errors).toEqual(errors);
      expect(result.subject).toEqual(subject);
      expect(result.body).toEqual(body);
      expect(query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining(
          errors.length ? 'previewed_at=NULL' : 'previewed_at=now()',
        ),
        [1],
      );
    },
  );
});
