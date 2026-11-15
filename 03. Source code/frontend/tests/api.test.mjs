import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, ApiError } from '../src/api.ts';
test('API failures preserve structured public filter results for the zero-recipient state', async t=>{
  const filter={original:2,valid:0,excluded:2};
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:'Không còn người nhận hợp lệ',filter}),{status:409}));
  await assert.rejects(()=>api('campaigns','POST',{}),error=>{
    assert.ok(error instanceof ApiError);assert.equal(error.status,409);assert.deepEqual(error.data.filter,filter);return true;
  });
});
test('a proxy error with a null body still produces a recoverable API error',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('null',{status:502}));
  await assert.rejects(()=>api('campaigns'),error=>error instanceof ApiError&&error.status===502);
});
