const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../../../api/index.js'), 'utf8');

function load(create) {
  const result = { exports: {} };
  vm.runInNewContext(source, {
    module: result,
    require(name) {
      if (name.endsWith('@nestjs/core')) return { NestFactory: { create } };
      if (name.endsWith('cookie-parser')) return () => 'cookie-middleware';
      if (name.endsWith('dist/app.module')) return { AppModule: 'app-module' };
      throw Error('Unexpected import');
    },
  });
  return result.exports;
}

test('concurrent requests share init and preserve URL/body/request objects', async () => {
  let creates = 0;
  let initialized = 0;
  const received = [];
  const handler = load(async module => {
    assert.equal(module, 'app-module');
    creates++;
    return {
      use(middleware) { assert.equal(middleware, 'cookie-middleware'); },
      async init() { initialized++; },
      getHttpAdapter() { return { getInstance: () => (req, res) => received.push([req, res]) }; },
    };
  });
  const req = { url: '/api/internal/jobs/inbox?test=1', body: { value: 1 } };
  const res = {};
  await Promise.all([handler(req, res), handler(req, res)]);
  assert.equal(creates, 1);
  assert.equal(initialized, 1);
  assert.equal(received.length, 2);
  assert.equal(received[0][0], req);
  assert.equal(received[0][1], res);
  assert.equal(req.url, '/api/internal/jobs/inbox?test=1');
  assert.deepEqual(req.body, { value: 1 });
});

test('failed initialization can retry on the next invocation', async () => {
  let creates = 0;
  const handler = load(async () => {
    creates++;
    if (creates === 1) throw Error('temporary init failure');
    return { use() {}, async init() {}, getHttpAdapter() { return { getInstance: () => () => 'ok' }; } };
  });
  await assert.rejects(handler({}, {}), /temporary init failure/);
  assert.equal(await handler({}, {}), 'ok');
  assert.equal(creates, 2);
});
