import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFollowupExhausted, followupDeadline } from '../src/followupResult.ts';

const exhausted = { status: 'done', outcome: 'no_response', attempt: 2, max_attempts: 2 };
test('confirmed no response on the last attempt shows the exhausted screen for any configured limit', () => {
  for (const limit of [1, 2, 3]) assert.equal(isFollowupExhausted({ ...exhausted, attempt: limit, max_attempts: limit }), true);
});
test('responded, awaiting, pending, cancelled and remaining attempts keep the detail screen', () => {
  for (const change of [{ outcome: 'responded' }, { outcome: 'awaiting' }, { outcome: null }, { status: 'pending' }, { status: 'cancelled' }, { attempt: 1 }]) {
    assert.equal(isFollowupExhausted({ ...exhausted, ...change }), false);
  }
});
test('invalid or missing attempt limits never imply exhaustion', () => {
  for (const max_attempts of [0, -1, NaN, 1.5]) assert.equal(isFollowupExhausted({ ...exhausted, max_attempts }), false);
});
test('response deadline follows the BE wait period, not the appointment or current clock', () => {
  assert.equal(followupDeadline('2026-11-13T10:00:00Z', 2), '2026-11-15T10:00:00.000Z');
  for (const value of [null, undefined, 'bad-date']) assert.equal(followupDeadline(value, 2), undefined);
  assert.equal(followupDeadline('2026-11-13T10:00:00Z', 0), undefined);
});
