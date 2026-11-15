import { Injectable } from '@nestjs/common';
@Injectable()
export class SerpProvider {
  configured() {
    return Boolean(process.env.SERPAPI_API_KEY?.trim());
  }
  async search(
    query: string,
    start: number,
    signal: AbortSignal,
  ): Promise<{ id: string; urls: string[]; next: number | null }> {
    const url = new URL('https://serpapi.com/search.json');
    for (const [k, v] of Object.entries({
      engine: 'google',
      q: query,
      start: String(start),
      hl: 'vi',
      gl: 'vn',
      api_key: process.env.SERPAPI_API_KEY || '',
    }))
      url.searchParams.set(k, v);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(40000)]),
      });
    } catch {
      throw Error('Không kết nối được SerpAPI. Kiểm tra mạng rồi tìm lại.');
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(
        response.status === 401
          ? 'SerpAPI key không hợp lệ.'
          : response.status === 429
            ? 'SerpAPI đã hết hạn mức hoặc đang giới hạn yêu cầu.'
            : `SerpAPI trả HTTP ${response.status}.`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error('SerpAPI không trả dữ liệu.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw Error('Kết quả SerpAPI vượt giới hạn.');
      }
      chunks.push(part.value);
    }
    let data: {
      error?: unknown;
      search_metadata?: { id?: string; status?: string };
      organic_results?: { link?: unknown; displayed_link?: unknown }[];
      serpapi_pagination?: { next?: string };
    };
    try {
      data = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof data;
    } catch {
      throw Error('Dữ liệu SerpAPI không hợp lệ.');
    }
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      (Array.isArray(data.organic_results) &&
        data.organic_results.some((r) => !r || typeof r !== 'object'))
    )
      throw Error('Dữ liệu SerpAPI không hợp lệ.');
    if (
      data.search_metadata?.status === 'Success' &&
      data.error === "Google hasn't returned any results for this query." &&
      !data.organic_results?.length
    )
      return {
        id: String(data.search_metadata.id || ''),
        urls: [],
        next: null,
      };
    if (
      data.error ||
      data.search_metadata?.status !== 'Success' ||
      (data.organic_results !== undefined &&
        !Array.isArray(data.organic_results))
    )
      throw Error('SerpAPI chưa hoàn tất hoặc trả kết quả lỗi.');
    let next: number | null = null;
    if (data.serpapi_pagination?.next) {
      try {
        const n = Number(
          new URL(data.serpapi_pagination.next).searchParams.get('start'),
        );
        if (Number.isSafeInteger(n) && n > start) next = n;
      } catch {
        /* No usable pagination. */
      }
    }
    return {
      id: String(data.search_metadata.id || ''),
      urls: (data.organic_results || []).flatMap((r) => {
        if (typeof r.link !== 'string') return [];
        try {
          const link = new URL(r.link);
          if (
            ['google.com', 'www.google.com'].includes(link.hostname) &&
            ['/goto', '/url'].includes(link.pathname)
          ) {
            // Opaque Google links: discover the displayed site, never crawl Google or guess a truncated path.
            const displayed =
              typeof r.displayed_link === 'string'
                ? r.displayed_link.match(/^https?:\/\/[^\s/›]+/)?.[0]
                : undefined;
            return displayed ? [new URL(displayed).origin + '/'] : [];
          }
          return [r.link];
        } catch {
          return [];
        }
      }),
      next,
    };
  }
}
