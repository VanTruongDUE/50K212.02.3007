import { SerpProvider } from './serp.provider';
describe('SerpAPI adapter', () => {
  it('uses the displayed site origin when Google returns an opaque goto link', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          search_metadata: { status: 'Success' },
          organic_results: [
            {
              link: 'https://www.google.com/goto?url=opaque',
              displayed_link: 'https://company.example.com › contact › ...',
            },
          ],
        }),
      ),
    );
    expect(
      (await provider.search('test', 0, new AbortController().signal)).urls,
    ).toEqual(['https://company.example.com/']);
  });
  it('stops pagination when Google reports no results on a successful search', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          search_metadata: { id: 'empty-page', status: 'Success' },
          error: "Google hasn't returned any results for this query.",
        }),
      ),
    );
    await expect(
      provider.search('query', 10, new AbortController().signal),
    ).resolves.toEqual({ id: 'empty-page', urls: [], next: null });
  });
  it.each([
    null,
    [],
    { search_metadata: { status: 'Success' }, organic_results: [null] },
  ])('rejects invalid response shape %j', async (body) => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(
      new SerpProvider().search('test', 0, new AbortController().signal),
    ).rejects.toThrow('không hợp lệ');
  });
  const provider = new SerpProvider();
  afterEach(() => jest.restoreAllMocks());
  it('parses organic URLs and bounded pagination', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          search_metadata: { status: 'Success', id: 'fixture' },
          organic_results: [{ link: 'https://example.com' }, { link: 42 }],
          serpapi_pagination: {
            next: 'https://serpapi.com/search.json?start=10',
          },
        }),
      ),
    );
    expect(
      await provider.search('test', 0, new AbortController().signal),
    ).toEqual({ id: 'fixture', urls: ['https://example.com'], next: 10 });
    expect((spy.mock.calls[0][0] as URL).href).toContain('engine=google');
  });
  it('distinguishes empty success from malformed provider responses', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            search_metadata: { status: 'Success' },
            organic_results: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'secret details' })),
      );
    expect(
      (await provider.search('test', 0, new AbortController().signal)).urls,
    ).toEqual([]);
    await expect(
      provider.search('test', 0, new AbortController().signal),
    ).rejects.toThrow('kết quả lỗi');
  });
  it.each([401, 429, 500])(
    'rejects HTTP %s without leaking provider response',
    async (status) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('private upstream text', { status }));
      await expect(
        provider.search('test', 0, new AbortController().signal),
      ).rejects.not.toThrow('private upstream text');
    },
  );
});
