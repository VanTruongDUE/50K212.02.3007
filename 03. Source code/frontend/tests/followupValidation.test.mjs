import assert from 'node:assert/strict';
import { test } from 'node:test';
import { followupValidation } from '../src/followupValidation.ts';
const valid={goal:'Tư vấn',due:'',reminderMinutes:'60',waitDays:'2',maxAttempts:'3',intervalDays:'2'};
test('Follow-up fields retain backend limits and allow its default due date',()=>assert.deepEqual(followupValidation(valid),{}));
test('Follow-up reports each invalid field before submission without discarding inputs',()=>{
  const input={...valid,goal:' ',due:'bad',waitDays:'0',maxAttempts:'4',intervalDays:'1.5',reminderMinutes:'-1'}, before=structuredClone(input);
  assert.equal(Object.keys(followupValidation(input)).length,6);assert.deepEqual(input,before);
});
