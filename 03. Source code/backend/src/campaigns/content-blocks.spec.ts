import { parseCampaignBody, renderCampaignBody } from './content-blocks';

describe('Campaign email blocks', () => {
  const image = { id: '7', kind: 'image', file_name: 'webinar.png' };

  it('renders a saved image, button and divider in both email parts', () => {
    const result = renderCampaignBody(
      'Chào {{Họ tên}}\n[[Hình ảnh:7]][[Nút:Đăng ký|https://example.com/register?x=1&y=2]][[Đường phân cách]]',
      [image],
      (text) => text.replaceAll('{{Họ tên}}', 'Hà'),
    );
    expect(result.text).toContain('Chào Hà');
    expect(result.text).toContain(
      'Đăng ký: https://example.com/register?x=1&y=2',
    );
    expect(result.html).toContain('cid:v5-image-7');
    expect(result.html).toContain('x=1&amp;y=2');
    expect(result.html).toContain('<hr');
  });

  it('rejects placeholder blocks and unsafe links', () => {
    expect(() => parseCampaignBody('[[Hình ảnh]]')).toThrow();
    expect(() =>
      parseCampaignBody('[[Nút:Click|javascript:alert(1)]]'),
    ).toThrow();
    expect(() => renderCampaignBody('[[Hình ảnh:7]]', [])).toThrow();
  });

  it('matches the editor toolbar formatting without allowing HTML injection', () => {
    const result = renderCampaignBody(
      '**Đậm** _Nghiêng_ ~Gạch chân~ <script>',
      [],
    );
    expect(result.html).toContain('<strong>Đậm</strong>');
    expect(result.html).toContain('<em>Nghiêng</em>');
    expect(result.html).toContain('<u>Gạch chân</u>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});
