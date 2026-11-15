import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invalidEmailVariable, inlineParts } from '../src/campaignContent.ts';
test('supported personalization is accepted while unknown and incomplete variables explain the correction',()=>{
  assert.equal(invalidEmailVariable('Kính gửi {{Họ tên}} tại {{Tên doanh nghiệp}}'), '');
  assert.ok(invalidEmailVariable('{{Chức vụ}}').includes('{{Chức vụ}}'));
  assert.ok(invalidEmailVariable('Kính gửi {{Họ tên'));
});
test('combined formatting retains nesting and incomplete markers retain every character',()=>{
  assert.deepEqual(inlineParts('**_text_**'),[{tag:'strong',parts:[{tag:'em',parts:['text']}]}]);
  for(const value of ['_abc','~abc','**abc'])assert.deepEqual(inlineParts(value),[value]);
});
