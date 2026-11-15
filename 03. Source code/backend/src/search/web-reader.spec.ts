import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { EventEmitter } from 'node:events';
jest.mock('node:https', () => ({ request: jest.fn() }));
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
import { WebReader } from './web-reader';
describe('website network boundary', () => {
  it('pins both single and array DNS lookups to the checked address', async () => {
    jest
      .mocked(lookup)
      .mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
    jest.mocked(request).mockImplementation(((
      _url: unknown,
      options: {
        lookup: (
          host: string,
          options: { all: boolean },
          cb: (...args: unknown[]) => void,
        ) => void;
      },
      done: (res: EventEmitter) => void,
    ) => {
      const cb = jest.fn();
      options.lookup('example.com', { all: true }, cb);
      expect(cb).toHaveBeenLastCalledWith(null, [
        { address: '8.8.8.8', family: 4 },
      ]);
      options.lookup('example.com', { all: false }, cb);
      expect(cb).toHaveBeenLastCalledWith(null, '8.8.8.8', 4);
      const req = Object.assign(new EventEmitter(), {
        end: () => {
          const res = Object.assign(new EventEmitter(), {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            resume: jest.fn(),
          });
          done(res);
          queueMicrotask(() => {
            res.emit('data', Buffer.from('<p>Contact</p>'));
            res.emit('end');
            req.emit('close');
          });
        },
        destroy: jest.fn(),
      });
      return req;
    }) as typeof request);
    expect(
      (
        await new WebReader(new AbortController().signal).read(
          'https://example.com',
        )
      ).html,
    ).toContain('Contact');
  });
  afterEach(() => jest.resetAllMocks());
  it.each([
    'file:///etc/passwd',
    'ftp://example.com',
    'http://localhost',
    'http://127.0.0.1',
    'http://example.com:3000',
    'https://user:pass@example.com',
    'http://metadata.internal',
  ])('rejects %s before DNS or HTTP', async (url) => {
    const spy = jest.mocked(lookup);
    await expect(
      new WebReader(new AbortController().signal).read(url),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it('rejects a public-looking hostname resolving to any private address', async () => {
    jest.mocked(lookup).mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ] as never);
    await expect(
      new WebReader(new AbortController().signal).read('https://example.com'),
    ).rejects.toThrow('công khai');
  });
  it('stops before DNS when the job is cancelled', async () => {
    const spy = jest.mocked(lookup);
    const controller = new AbortController();
    controller.abort();
    await expect(
      new WebReader(controller.signal).read('https://example.com'),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});
