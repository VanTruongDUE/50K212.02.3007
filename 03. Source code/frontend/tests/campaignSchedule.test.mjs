import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedFinish, scheduleError, scheduleStartError, scheduleOptionsError } from '../src/campaignSchedule.ts';

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
