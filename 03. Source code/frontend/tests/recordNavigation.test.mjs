import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationParams, recordContext, recordKey, recordRequired, selectedRecord } from '../src/recordNavigation.ts';

test('each record type has its own URL identity, including Response → create Follow-up', () => {
  for (const [screen, key] of Object.entries({
    'contact-list-detail': 'listId', 'manager-review-detail': 'listId',
    'response-detail': 'responseId', 'followup-create': 'responseId',
    'followup-result': 'followupId', 'campaign-editor': 'campaignId',
    'manager-account-edit': 'senderId', 'template-edit': 'filterId',
  })) assert.equal(recordKey(screen), key);
});

test('chosen record survives serialization/reload and same-module navigation', () => {
  for (const screen of ['contact-list-detail', 'response-detail', 'followup-result', 'campaign-editor']) {
    const key = recordKey(screen);
    const params = navigationParams(screen, new URLSearchParams('screen=contact-lists&listId=6'), { key, id: '9' });
    params.set('screen', screen);
    assert.deepEqual(recordContext(screen, params.toString()), { key, id: '9' });
    assert.equal(navigationParams(screen, params).get(key), '9');
  }
});

test('changing modules drops stale IDs, even when numeric IDs collide', () => {
  const current = new URLSearchParams('screen=contact-list-detail&listId=6&searchId=1');
  assert.equal(navigationParams('response-list', current).toString(), '');
  assert.equal(recordContext('response-detail', '?listId=6').id, '');
  assert.equal(navigationParams('followup-result', new URLSearchParams('screen=response-detail&responseId=9')).toString(), '');
  assert.equal(navigationParams('followup-create', new URLSearchParams('screen=response-detail&responseId=9')).get('responseId'), '9');
});

test('invalid or inaccessible explicit IDs never select the first record', () => {
  const items = [{ id: '6' }, { id: '9' }];
  assert.equal(selectedRecord(items, 'missing'), undefined);
  assert.equal(selectedRecord(items, '9'), items[1]);
  assert.equal(selectedRecord(items, ''), items[0]);
  assert.equal(navigationParams('response-list', new URLSearchParams('screen=response-detail&responseId=999'), { key: 'responseId', id: '' }).has('responseId'), false);
});

test('search context stays inside search routes', () => {
  const current = new URLSearchParams('screen=history&searchId=12');
  assert.equal(navigationParams('history-detail', current).get('searchId'), '12');
  assert.equal(navigationParams('contact-lists', current).has('searchId'), false);
});

test('returning to a collection or new form drops the previous record ID', () => {
  for (const screen of ['response-list', 'campaign-list', 'followup-list', 'manager-account-list', 'template-create']) {
    const key = recordKey(screen);
    assert.equal(navigationParams(screen, new URLSearchParams(`screen=${screen}&${key}=2`), { key, id: '2' }).has(key), false);
  }
});

test('old detail URLs without identity must require a new selection', () => {
  for (const screen of ['contact-list-detail', 'response-detail', 'followup-result', 'campaign-editor', 'template-edit']) assert.equal(recordRequired(screen), true);
  assert.equal(recordRequired('followup-create'), false);
  assert.equal(recordRequired('response-list'), false);
});
