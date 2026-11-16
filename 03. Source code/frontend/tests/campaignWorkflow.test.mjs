import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignStage, campaignLabel, campaignNext } from '../src/campaignWorkflow.ts';

test('campaign progress maps labels and resume routes to persisted preparation fields', () => {
  const cases = [
    [{ status: 'pending_approval' }, 'Chờ kiểm tra danh sách', undefined],
    [{ status: 'rejected' }, 'Danh sách không đạt', 'campaign-contacts'],
    [{ status: 'approved' }, 'Danh sách đã duyệt', 'campaign-email'],
    [{ status: 'approved', subject: 'Nội dung' }, 'Đã có nội dung', 'campaign-sender'],
    [{ status: 'approved', subject: 'Nội dung', sender_account_id: '3' }, 'Đã chọn tài khoản', 'campaign-schedule'],
    [{ status: 'approved', subject: 'Nội dung', sender_account_id: '3', scheduled_at: '2026-11-20' }, 'Chờ xác nhận', 'campaign-confirm'],
    [{ status: 'sending', subject: 'Nội dung' }, 'Đang gửi', undefined],
    [{ status: 'completed' }, 'Hoàn thành', undefined],
  ];
  for (const [campaign, label, next] of cases) {
    assert.equal(campaignLabel(campaign), label);
    assert.equal(campaignNext(campaign), next);
  }
  assert.equal(campaignStage({ status: 'paused', scheduled_at: '2026-11-20' }), 'paused');
});
