import assert from 'node:assert/strict';
import { test } from 'node:test';
import { senderValidation, senderProfileValidation } from '../src/senderValidation.ts';

const valid = { name: 'Marketing', email: 'marketing@example.com', smtpHost: 'smtp.gmail.com', smtpPort: '465', smtpUser: 'marketing@example.com', quotaDaily: '100' };
test('valid Gmail configuration and boundary ports retain the existing API limits', () => {
  for (const smtpPort of ['1', '465', '587', '65535']) assert.deepEqual(senderValidation({ ...valid, smtpPort }), {});
});
test('invalid fields receive individual Vietnamese messages without changing entered data', () => {
  const form = { name: '', email: 'wrong@', smtpHost: ' ', smtpPort: '65536', smtpUser: '', quotaDaily: '101' };
  const before = structuredClone(form);
  assert.equal(Object.keys(senderValidation(form)).length, 6);
  assert.deepEqual(form, before);
  for (const value of ['', '0', '-1', '1.5', 'NaN']) {
    assert.ok(senderValidation({ ...valid, smtpPort: value }).smtpPort);
    assert.ok(senderValidation({ ...valid, quotaDaily: value }).quotaDaily);
  }
});

test('sender name and code follow the Figma fields without accepting whitespace or markup in identifiers', () => {
  assert.equal(senderValidation({ ...valid, name: 'x'.repeat(50), code: 'MKT-01' }).name, undefined);
  assert.ok(senderValidation({ ...valid, name: 'x'.repeat(51) }).name);
  for (const code of ['', ' ', '<script>', 'x'.repeat(51)]) assert.ok(senderValidation({ ...valid, code }).code);
});


test('sender profile form validates hourly limits without requiring connection fields', () => {
  const form = { name: 'Marketing', code: 'MKT01', email: 'marketing@example.com', quotaDaily: '100', quotaHourly: '50' };
  assert.deepEqual(senderProfileValidation(form), {});
  for (const quotaHourly of ['', '0', '101', '1.5']) assert.ok(senderProfileValidation({...form,quotaHourly}).quotaHourly);
  const {code, ...update} = form;
  assert.deepEqual(senderProfileValidation(update), {});
  assert.equal(code, 'MKT01');
});
