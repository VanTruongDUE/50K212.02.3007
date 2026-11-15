import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import robotsParser from 'robots-parser';

export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export class WebReader {
  private robots = new Map<string, string>();
  constructor(private signal: AbortSignal) {}
  async read(url: string): Promise<{ html: string; url: string }> {
    return this.fetch(url, 0, true);
  }
  private async fetch(
    raw: string,
    redirects: number,
    checkRobots: boolean,
  ): Promise<{ html: string; url: string }> {
    this.signal.throwIfAborted();
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      redirects > 3
    )
      throw Error('URL không được phép.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      !host.includes('.') ||
      /\.(local|internal|localhost)$/i.test(host)
    )
      throw Error('Không được truy cập địa chỉ nội bộ.');
    if (isIP(host) && !publicAddress(host))
      throw Error('Đích mạng không công khai.');
    const addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(Error('DNS quá thời gian.')),
          5000,
        );
        timer.unref();
      }),
    ]);
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw Error('Đích mạng không công khai.');
    if (checkRobots) {
      let rules = this.robots.get(url.origin);
      if (rules === undefined) {
        rules = (await this.fetch(url.origin + '/robots.txt', 0, false)).html;
        this.robots.set(url.origin, rules);
      }
      if (
        robotsParser(url.origin + '/robots.txt', rules).isAllowed(
          url.href,
          'V5ContactSearch',
        ) === false
      )
        throw Error('Website không cho phép thu thập trang này.');
    }
    const address = addresses[0];
    return new Promise((resolve, reject) => {
      const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          signal: this.signal,
          headers: {
            'User-Agent': 'V5ContactSearch/1.0',
            Accept: 'text/html,text/plain',
            'Accept-Encoding': 'identity',
          },
          // Node may request an address array for automatic IPv4/IPv6 selection.
          lookup: (_hostname, options, callback) =>
            options.all
              ? callback(null, [address])
              : callback(null, address.address, address.family),
        },
        (res) => {
          const code = res.statusCode || 0;
          if (
            [301, 302, 303, 307, 308].includes(code) &&
            res.headers.location
          ) {
            res.resume();
            void this.fetch(
              new URL(res.headers.location, url).href,
              redirects + 1,
              checkRobots,
            ).then(resolve, reject);
            return;
          }
          if (!checkRobots && (code === 404 || code === 410)) {
            res.resume();
            resolve({ html: '', url: url.href });
            return;
          }
          if (code < 200 || code >= 300) {
            res.resume();
            reject(Error(`Website trả HTTP ${code}.`));
            return;
          }
          if (
            res.headers['content-encoding'] &&
            res.headers['content-encoding'] !== 'identity'
          ) {
            res.destroy();
            reject(Error('Website trả dữ liệu nén không hỗ trợ.'));
            return;
          }
          if (
            !/text\/(html|plain)|application\/xhtml\+xml/i.test(
              res.headers['content-type'] || '',
            )
          ) {
            res.destroy();
            reject(Error('Định dạng trang chưa hỗ trợ.'));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2_000_000) {
              res.destroy(Error('Trang vượt giới hạn 2 MB.'));
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () =>
            resolve({
              html: Buffer.concat(chunks).toString('utf8'),
              url: url.href,
            }),
          );
          res.on('error', reject);
        },
      );
      const timer = setTimeout(
        () => req.destroy(Error('Website quá thời gian 10 giây.')),
        10000,
      );
      req.on('close', () => clearTimeout(timer));
      req.on('error', reject);
      req.end();
    });
  }
}
