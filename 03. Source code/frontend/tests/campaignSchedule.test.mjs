import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedFinish, sendDuration, scheduleError, scheduleStartError, scheduleOptionsError, scheduleFieldErrors } from '../src/campaignSchedule.ts';

test('scheduled confirmation rejects expired and over-90-day schedules, with exact 15-minute boundary', () => {
  const now = Date.parse('2026-11-15T00:00:00Z');
  assert.ok(scheduleError('2026-11-15T00:14:59Z', now));
  assert.equal(scheduleError('2026-11-15T00:15:00Z', now), '');
  assert.ok(scheduleError(new Date(now + 91 * 86400000).toISOString(), now));
  assert.ok(scheduleError('bad', now));
});
test('scheduled start uses the GMT+7 window and rejects its exclusive closing boundary',()=>{
  const now=Date.parse('2026-11-14T00:00:00Z');
  assert.ok(scheduleStartError('2026-11-15T00:30:00Z','08:00','17:00',now));
  assert.equal(scheduleStartError('2026-11-15T01:00:00Z','08:00','17:00',now),'');
  assert.ok(scheduleStartError('2026-11-15T10:00:00Z','08:00','17:00',now));
  for(const [from,to] of [['','17:00'],['08:99','17:00'],['17:00','08:00']])assert.ok(scheduleOptionsError(50,from,to));
});
test('estimate observes GMT+7 window, rolls to next day and leaves immediate sends unrestricted', () => {
  assert.equal(expectedFinish('2026-11-15T09:59:00Z', 2, 50), '2026-11-16T01:00:00.000Z');
  assert.equal(expectedFinish('2026-11-15T09:59:00Z', 2, 50, '08:00', '17:00', true), '2026-11-15T10:00:12.000Z');
  assert.equal(expectedFinish('2026-11-15T00:00:00Z', 1), '2026-11-15T01:00:00.000Z');
  assert.equal(expectedFinish('bad', 2), undefined);
  assert.equal(expectedFinish('2026-11-15T00:00:00Z', 0), undefined);
});

test('daily allowance carries remaining recipients to next GMT+7 day and resets usage for future dates', () => {
  const now = Date.parse('2026-11-15T01:00:00Z');
  assert.equal(expectedFinish('2026-11-15T01:00:00Z', 3, 50, '08:00', '17:00', false, 2, 0, now), '2026-11-16T01:00:00.000Z');
  assert.equal(expectedFinish('2026-11-15T01:00:00Z', 2, 50, '08:00', '17:00', false, 2, 1, now), '2026-11-16T01:00:00.000Z');
  assert.equal(expectedFinish('2026-11-16T01:00:00Z', 2, 50, '08:00', '17:00', false, 2, 1, now), '2026-11-16T01:01:12.000Z');
  assert.equal(expectedFinish('2026-11-15T16:59:00Z', 2, 50, '08:00', '17:00', true, 2, 1, now), '2026-11-15T17:00:12.000Z');
});


test('immediate confirmation uses duration, independent of an old saved start', () => {
  assert.equal(sendDuration(800,50), 'Sau 16 giờ gửi trong khung giờ');
  assert.equal(sendDuration(18,50), 'Sau 0 giờ 22 phút gửi trong khung giờ');
  assert.equal(sendDuration(7,50,'08:00','17:00'), 'Sau 0 giờ 9 phút gửi trong khung 08:00 - 17:00');
  assert.equal(sendDuration(0,50), '—');
});

const now = Date.parse('2026-11-16T01:00:00Z');
test('schedule validation identifies missing date/time and permits immediate sending without them', () => {
  assert.deepEqual(scheduleFieldErrors('', 50, '08:00', '17:00', false, now), { date: 'Chọn ngày bắt đầu.', time: 'Chọn giờ bắt đầu.' });
  assert.deepEqual(scheduleFieldErrors('', 50, '08:00', '17:00', true, now), {});
  assert.deepEqual(scheduleFieldErrors('2026-11-17T09:00', 50, '08:00', '17:00', false, now), {});
});
test('schedule validation reports date bounds, outside-window time and invalid sending options at their fields', () => {
  assert.ok(scheduleFieldErrors('2026-11-16T08:05', 50, '08:00', '17:00', false, now).date);
  assert.ok(scheduleFieldErrors('2027-11-17T09:00', 50, '08:00', '17:00', false, now).date);
  assert.ok(scheduleFieldErrors('2026-11-17T18:00', 50, '08:00', '17:00', false, now).time);
  assert.ok(scheduleFieldErrors('', 0, '', '', true, now).rate);
  assert.ok(scheduleFieldErrors('', 50, '', '', true, now).from);
  assert.ok(scheduleFieldErrors('', 50, '17:00', '08:00', true, now).to);
});
